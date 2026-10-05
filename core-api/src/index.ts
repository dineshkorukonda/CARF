import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Auto-load .env file if running directly under Node in production
try {
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
  }
} catch {
  // Ignore if already loaded or not found
}

import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { loadCarfConfig } from "./config/carfConfig.js";
import { watchCarfConfig } from "./config/carfConfigWatcher.js";
import { githubApiClient, getInstallationTokenClient } from "./adapters/github/client.js";
import { handleWebhookCommit } from "./webhookOrchestrator.js";

import { prisma } from "./db/client.js";
import { PM2Adapter } from "./adapters/pm2.js";
import { RolloutMonitor } from "./monitor/rolloutMonitor.js";
import type { RolloutOutcomePrismaClient } from "./adapters/rolloutOutcome.js";
import { startSampleRetentionJob, type SampleRetentionJob } from "./retention/sampleRetention.js";
import { dispatchRollbackAlert } from "./alerts/dispatch.js";
import { resolveRepoAdapterConfig } from "./config/repoAdapterConfig.js";

// Issue #60: real end-to-end webhook test commit.
// Issue #60: second probe -- retest push webhook delivery after the earlier 404.
// Fail closed: an invalid .carf.yml crashes startup rather than silently falling back to
// defaults -- inherited from src/config/carfConfig.ts's documented contract (see
// docs/superpowers/specs/2026-08-24-carf-yml-config-design.md). `let`, not `const`: the
// watcher below reassigns this on a successful hot-reload (issue #57). The onValidWebhook
// closure reads this binding fresh on every call, so a reassignment here is picked up by
// the very next webhook without any change to webhookOrchestrator.ts's interface.
let carfConfig = loadCarfConfig();
const installationTokenClient = getInstallationTokenClient();

// The onValidWebhook closure below references `app.log` -- it's only ever invoked later,
// on a real incoming request, by which point `app`'s const binding is already
// initialized. Standard self-referencing-closure pattern; safe despite the apparent
// ordering.
// eslint-disable-next-line prefer-const
let rolloutMonitor: RolloutMonitor;
let retentionJob: SampleRetentionJob;

const app = buildApp({
  augmentThreshold: {
    classifyMissingCommit: async ({ owner, repo, sha, installationId }) => {
      const token = await installationTokenClient.getInstallationToken(installationId);
      const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(sha)}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`GitHub commit lookup returned HTTP ${response.status}`);
      const commit = await response.json() as { sha: string; parents: Array<{ sha: string }> };
      const baseSha = commit.parents[0]?.sha;
      if (!baseSha) throw new Error("Commit has no parent to compare");
      await handleWebhookCommit({ owner, repo, headSha: commit.sha, baseSha, installationId, event: "push" }, {
        githubApiClient, installationTokenClient, carfConfig, logger: app.log, observeLive: false,
      });
    },
  },
  webhook: {
    webhookSecret: env.githubWebhookSecret(),
    onValidWebhook: (target) =>
      handleWebhookCommit(target, {
        githubApiClient,
        installationTokenClient,
        carfConfig,
        logger: app.log,
        rolloutMonitor,
        deferGithubActionsDeployment: true,
      }),
  },
  refreshCommits: {
    getInstallationToken: (installationId) => installationTokenClient.getInstallationToken(installationId),
    classifyCommit: (target, classifyOptions) =>
      handleWebhookCommit(target, {
        githubApiClient,
        installationTokenClient,
        carfConfig,
        logger: app.log,
        rolloutMonitor,
        observeLive: classifyOptions?.observeLive === true,
        rollbackViaActions: classifyOptions?.rollbackViaActions === true,
      }),
  },
});

rolloutMonitor = new RolloutMonitor({
  prismaClient: prisma as unknown as RolloutOutcomePrismaClient,
  logger: app.log,
  onRollbackAlert: (event) => dispatchRollbackAlert(process.env.CARF_ALERT_WEBHOOK_URL, event),
  adapterFactory: async (outcome) => {
    if (!outcome.owner || !outcome.repo || !outcome.installationId) return undefined;
    const [connection, commit] = await Promise.all([
      prisma.repoConnection.findUnique({ where: { installationId_owner_repo: { installationId: outcome.installationId, owner: outcome.owner, repo: outcome.repo } } }),
      prisma.commit.findFirst({ where: { installationId: outcome.installationId, owner: outcome.owner, repo: outcome.repo, sha: outcome.commitSha } }),
    ]);
    const previousSha = outcome.previousSha ?? commit?.baseSha;
    if (!previousSha || /^0+$/.test(previousSha)) return undefined;
    const adapterConfig = resolveRepoAdapterConfig(connection?.storedConfig, connection?.pm2Process, carfConfig?.adapter);
    if (!adapterConfig) return undefined;
    const firstTarget = adapterConfig.targets?.[0];
    const targetName =
      adapterConfig.target ??
      (typeof firstTarget === "string" ? firstTarget : firstTarget?.name) ??
      "";
    return new PM2Adapter(previousSha, {
      target: targetName,
      releasesRoot: adapterConfig.releasesRoot,
      currentSymlink: adapterConfig.currentSymlink,
      cwd: adapterConfig.cwd,
      buildCommand: adapterConfig.buildCommand,
      layout: adapterConfig.layout,
      healthUrl: adapterConfig.healthUrl,
      startupGraceSeconds: adapterConfig.startupGraceSeconds,
      sharedPaths: adapterConfig.sharedPaths,
      probeCount: adapterConfig.probeCount,
    });
  },
});

watchCarfConfig({
  onReload: (reloaded) => {
    carfConfig = reloaded;
    app.log.info("carfConfig reloaded from .carf.yml");
  },
  onError: (error) => {
    // Fail closed: `carfConfig` is left untouched, so the last-known-good config keeps
    // serving webhooks -- matches loadCarfConfig()'s own initial-load contract.
    app.log.error({ error }, "failed to reload .carf.yml, keeping last-known-good config");
  },
});

app.addHook("onClose", async () => {
  if (retentionJob) {
    retentionJob.stop();
  }
  await rolloutMonitor.stop();
});

app
  .listen({ port: env.port, host: "0.0.0.0" })
  .then(async () => {
    // Start 30-day RolloutSample retention job on boot and every 24h
    retentionJob = startSampleRetentionJob({
      prismaClient: prisma as unknown as RolloutOutcomePrismaClient,
      logger: app.log,
      retentionDays: 30,
    });

    try {
      const recovered = await rolloutMonitor.recoverPending();
      if (recovered > 0) {
        app.log.info({ recovered }, "recovered pending rollout monitoring jobs on startup");
      }
    } catch (err) {
      app.log.error({ err }, "failed to recover pending rollout jobs on startup");
    }
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
