import { acquireDiff, fetchBlobContent } from "./adapters/github/diffAcquisition.js";
import { load as loadYaml } from "js-yaml";
import type { GitHubApiClient } from "./adapters/github/githubApiClient.js";
import type { InstallationTokenClient } from "./adapters/github/installationTokenClient.js";
import type { DeployTarget } from "./adapters/github/webhookPayload.js";
import { runStandaloneLoop } from "./adapters/loop.js";
import { PM2Adapter } from "./adapters/pm2.js";
import { DockerAdapter } from "./adapters/docker.js";
import type { RollbackAdapter } from "./adapters/rollbackAdapter.js";
import { createPendingRolloutOutcome, type RolloutOutcomePrismaClient, type RolloutOutcomeRecord } from "./adapters/rolloutOutcome.js";
import { ensureApiKeyForInstallation, type InstallationApiKeyPrismaClient } from "./auth/installationApiKeyService.js";
import {
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  DEFAULT_LOCK_TTL_MS,
  type StandaloneLoopLockPrismaClient,
} from "./adapters/standaloneLoopLock.js";
import { CarfConfigSchema, type CarfConfig } from "./config/carfConfigSchema.js";
import { mergeThresholdConfig } from "./config/mergeThresholdConfig.js";
import { prisma as defaultPrisma } from "./db/client.js";
import type { RolloutMonitor } from "./monitor/rolloutMonitor.js";
import { NoSignalError, processCommit, type PipelinePrismaClient } from "./pipeline.js";
import { resolveRepoMode } from "./deploymentMode.js";
import { resolveFromLegacy } from "./capabilities/resolver.js";
import { acquireDeploymentLease, guardAdapter } from "./adapters/deploymentLease.js";
import { resolveRepoAdapterConfig } from "./config/repoAdapterConfig.js";

export type AdapterConfig = NonNullable<CarfConfig["adapter"]>;

export interface OrchestratorLogger {
  info(details: Record<string, unknown>, message: string): void;
  error(details: Record<string, unknown>, message: string): void;
}

export interface WebhookOrchestratorDeps {
  githubApiClient: GitHubApiClient;
  installationTokenClient: InstallationTokenClient;
  /** Loaded once at startup (index.ts). undefined means no .carf.yml -- all defaults. */
  carfConfig: CarfConfig | undefined;
  logger: OrchestratorLogger;
  prismaClient?: PipelinePrismaClient;
  /** Testable seam for building RollbackAdapter. Defaults to PM2Adapter or DockerAdapter. */
  rollbackAdapterFactory?: (adapterConfig: AdapterConfig, baseSha: string) => RollbackAdapter;
  /** Testable seam; defaults to the real runStandaloneLoop. */
  standaloneLoopRunner?: typeof runStandaloneLoop;
  /** Background RolloutMonitor worker instance. */
  rolloutMonitor?: RolloutMonitor;
  /** Testable seam for the durable Standalone-loop lock; defaults to the real db/client.ts singleton. */
  lockPrismaClient?: StandaloneLoopLockPrismaClient;
  /** How long a lock can go without a heartbeat before another instance may reclaim it. */
  lockTtlMs?: number;
  /** How often the lock-holding instance renews its heartbeat while the loop runs. */
  heartbeatIntervalMs?: number;
  /** Testable seam for recording loop outcomes (issue #54); defaults to the real db/client.ts singleton. */
  rolloutOutcomePrismaClient?: RolloutOutcomePrismaClient;
  /** Testable seam for issuing installation API keys (issue #65); defaults to the real db/client.ts singleton. */
  apiKeyPrismaClient?: InstallationApiKeyPrismaClient;
  /**
   * When false, classify and persist the commit, then stop. Commit refresh uses this so
   * a historical SHA is not soaked against whatever the live process is running now.
   * Defaults to true (webhook delivery starts the standalone loop).
   */
  observeLive?: boolean;
  /** GitHub Actions owns the deploy trigger after its CI workflow succeeds. */
  deferGithubActionsDeployment?: boolean;
  /** Opt-in only from a CI-verified managed workflow that supplies a rollback job. */
  rollbackViaActions?: boolean;
  /** Apply the project's event selection only to automatic webhook deliveries. */
  respectAnalysisTrigger?: boolean;
}

function defaultRollbackAdapterFactory(adapterConfig: AdapterConfig, baseSha: string): RollbackAdapter {
  if (adapterConfig.kind === "pm2") {
    // baseSha stands in for the previous release SHA. See issue #51.
    return new PM2Adapter(baseSha, {
      releasesRoot: adapterConfig.releasesRoot,
      currentSymlink: adapterConfig.currentSymlink,
      cwd: adapterConfig.cwd,
      buildCommand: adapterConfig.buildCommand,
      layout: adapterConfig.layout,
      healthUrl: adapterConfig.healthUrl,
      probeCount: adapterConfig.probeCount,
    });
  }
  if (adapterConfig.kind === "docker") {
    return new DockerAdapter(adapterConfig.previousImageTag || baseSha, {
      containerName: adapterConfig.target || adapterConfig.containerName,
      composeFile: adapterConfig.composeFile,
      healthUrl: adapterConfig.healthUrl,
      probeCount: adapterConfig.probeCount,
      startupGraceSeconds: adapterConfig.startupGraceSeconds,
    });
  }
  throw new Error(`Adapter kind "${(adapterConfig as { kind: string }).kind}" is unsupported.`);
}


/**
 * Composition root for a validated webhook DeployTarget: exchanges the installation ID
 * for a token, fetches the diff from GitHub, runs it through processCommit() (classify +
 * persist + compute threshold), then branches on .carf.yml's `mode`:
 *   - Augment (or no mode / no .carf.yml at all): stops here. GET /v1/threshold
 *     (src/routes/threshold.ts) serves the persisted result separately.
 *   - Standalone with adapter.kind "pm2" or "docker": additionally kicks off runStandaloneLoop() in the background
 *     (not awaited -- the loop can run for the full threshold window, up to DEFAULT_CONFIG's
 *     largest baseWindow, which would hang the webhook's HTTP response if awaited).
 *   - Standalone with no adapter configured at all: logs an error and skips the loop.
 *     processCommit()'s result has already persisted successfully -- this is a partial
 *     success, not a failure of the webhook itself.
 */
export async function handleWebhookCommit(target: DeployTarget, deps: WebhookOrchestratorDeps): Promise<void> {
  // Issue #65: the earliest point core-api can vouch this installationId is real (it came
  // straight from a signature-verified GitHub webhook) -- ensure it has an auth key for
  // scoped reads (GET /v1/threshold etc.). Non-fatal: a hiccup here shouldn't drop an
  // otherwise-valid webhook, it just means the key gets minted on a later redelivery/push.
  try {
    const apiKeyClient = deps.apiKeyPrismaClient ?? (defaultPrisma as unknown as InstallationApiKeyPrismaClient);
    const result = await ensureApiKeyForInstallation(apiKeyClient, target.installationId);
    if (result.created) {
      // Only time this plaintext key ever exists outside the hash stored in the DB --
      // shown once, here, deliberately (see InstallationApiKey's schema doc comment).
      deps.logger.info(
        { installationId: target.installationId, apiKey: result.plaintextKey },
        "issued a new installation API key -- store it now, it cannot be recovered later"
      );
    }
  } catch (error) {
    deps.logger.error({ error, installationId: target.installationId }, "failed to ensure installation API key");
  }

  const token = await deps.installationTokenClient.getInstallationToken(target.installationId);
  let activeCarfConfig = deps.carfConfig;
  try {
    const rawRepoConfig = await fetchBlobContent(
      deps.githubApiClient,
      target.owner,
      target.repo,
      ".carf.yml",
      target.event === "pull_request" ? target.baseSha : target.headSha,
      token
    );
    if (rawRepoConfig) {
      const parsed = loadYaml(rawRepoConfig);
      const validated = CarfConfigSchema.safeParse(parsed ?? {});
      if (validated.success) {
        activeCarfConfig = validated.data;
        deps.logger.info(
          { owner: target.owner, repo: target.repo, sha: target.headSha },
          "loaded repo-specific .carf.yml config from commit"
        );
      } else {
        if (deps.respectAnalysisTrigger) throw new Error("Invalid repository .carf.yml; automatic analysis skipped");
        deps.logger.info(
          { owner: target.owner, repo: target.repo, issues: validated.error.issues },
          "malformed .carf.yml in repository commit, falling back to server default"
        );
      }
    }
  } catch (error) {
    if (deps.respectAnalysisTrigger) throw error;
    deps.logger.info({ error, owner: target.owner, repo: target.repo }, "failed to fetch .carf.yml from repository, falling back");
  }

  const repoSlug = `${target.owner}/${target.repo}`;
  const analysisTrigger = activeCarfConfig?.analysisTrigger ?? "both";
  if (deps.respectAnalysisTrigger && (
    (analysisTrigger === "commits" && target.event === "pull_request") ||
    (analysisTrigger === "pull_requests" && target.event === "push")
  )) {
    deps.logger.info({ repoSlug, event: target.event, analysisTrigger }, "skipping automatic analysis for unselected event");
    return;
  }
  const changedFiles = await acquireDiff(
    deps.githubApiClient, target.owner, target.repo, target.baseSha, target.headSha, token,
    target.event === "pull_request"
  );
  let result;
  try {
    result = await processCommit(target.headSha, repoSlug, changedFiles, {
      prismaClient: deps.prismaClient,
      baseSha: target.baseSha,
      installationId: target.installationId,
      thresholdConfig: mergeThresholdConfig(activeCarfConfig?.threshold),
      classificationRules: activeCarfConfig?.classification?.rules ?? [],
    });
  } catch (error) {
    if (error instanceof NoSignalError) {
      deps.logger.info(
        { sha: target.headSha, fileCount: changedFiles.length },
        "no classification signal, skipping threshold"
      );
      if (deps.observeLive === true && target.event === "push") throw new Error("Commit has no classification signal; deployment skipped");
      return;
    }
    throw error;
  }

  if (deps.observeLive === false || target.event === "pull_request") {
    deps.logger.info(
      { sha: target.headSha, owner: target.owner, repo: target.repo },
      "classified commit without starting a live rollback watch"
    );
    return;
  }

  const carfConfig = activeCarfConfig;

  const repoConnClient = (deps.rolloutOutcomePrismaClient ?? defaultPrisma) as unknown as {
    repoConnection?: {
      findUnique: (args: {
        where: { installationId_owner_repo: { installationId: string; owner: string; repo: string } };
      }) => Promise<{
        monitoringPaused?: boolean;
        mode?: string | null;
        deploymentIntegration?: string | null;
        runtimeAdapter?: string | null;
        storedConfig?: unknown;
        pm2Process?: string | null;
        installTokenHash?: string | null;
      } | null>;
    };
  };

  let connectionMode: ReturnType<typeof resolveRepoMode> | null = null;
  let connectionCapabilities: ReturnType<typeof resolveFromLegacy> | null = null;
  let monitoringPaused = false;
  let connectionAdapter = activeCarfConfig?.adapter;
  let connectionConfigFailed = false;
  if (repoConnClient.repoConnection?.findUnique) {
    try {
      const conn = await repoConnClient.repoConnection.findUnique({
        where: {
          installationId_owner_repo: {
            installationId: target.installationId,
            owner: target.owner,
            repo: target.repo,
          },
        },
      });
      if (conn) {
        connectionMode = resolveRepoMode(conn);
        connectionCapabilities = resolveFromLegacy(conn);
        monitoringPaused = Boolean(conn.monitoringPaused);
        if (connectionCapabilities.runtimeAdapter === "pm2" || connectionCapabilities.runtimeAdapter === "docker") {
          connectionAdapter = resolveRepoAdapterConfig(conn.storedConfig, conn.pm2Process, connectionAdapter);
        }
      }
    } catch (err) {
      connectionConfigFailed = true;
      deps.logger.error({ err }, "failed to load repository connection mode");
    }
  }

  if (connectionConfigFailed) {
    if (deps.observeLive === true) throw new Error("Cannot load deployment configuration; deployment skipped");
    return;
  }

  // Resolve 3-layer capabilities:
  // Precedence: explicit RepoConnection capabilities if connection exists,
  // else fallback to .carf.yml configuration.
  const resolved = connectionCapabilities ?? resolveFromLegacy({
    mode: carfConfig?.mode,
    deploymentIntegration: carfConfig?.deploymentIntegration,
    runtimeAdapter: carfConfig?.runtimeAdapter,
    adapter: carfConfig?.adapter,
  });

  // RepoConnection.mode is authoritative when a connection exists.
  // Augment repositories must never start a Standalone observation loop.
  const effectiveMode = connectionMode ?? carfConfig?.mode;
  if (deps.deferGithubActionsDeployment && effectiveMode === "standalone" && (resolved.runtimeAdapter === "pm2" || resolved.runtimeAdapter === "docker") && resolved.deploymentIntegration === "github_actions") {
    deps.logger.info({ owner: target.owner, repo: target.repo, sha: target.headSha }, "waiting for GitHub Actions CI before deployment");
    return;
  }
  if (effectiveMode !== "standalone" || !resolved.capabilities.rollback) {
    if (deps.observeLive === true) throw new Error("Repository is not configured for managed standalone deployment");
    deps.logger.info(
      { owner: target.owner, repo: target.repo, mode: effectiveMode ?? "unset" },
      "skipping standalone loop — repository is not configured as standalone"
    );
    return;
  }

  if (monitoringPaused) {
    if (deps.observeLive === true) throw new Error("Repository monitoring is paused; deployment skipped");
    deps.logger.info(
      { owner: target.owner, repo: target.repo },
      "monitoring is paused for this repository, skipping standalone monitor loop"
    );
    return;
  }

  const adapterConfig = connectionAdapter;
  if (deps.observeLive === true && adapterConfig?.kind === "pm2" && adapterConfig.layout === "git" && !adapterConfig.buildCommand?.trim()) {
    throw new Error("Git PM2 deployment requires an explicit buildCommand (use true for apps without a build step)");
  }
  if (!adapterConfig) {
    if (deps.observeLive === true) throw new Error("No runtime adapter configured; deployment skipped");
    deps.logger.error(
      { adapter: adapterConfig },
      "standalone mode configured but no adapter specified"
    );
    return;
  }

  if (target.event !== "push") {
    deps.logger.error(
      { adapter: adapterConfig, event: target.event },
      `${adapterConfig.kind} adapter requires a push event to safely derive the previous release/revision from baseSha`
    );
    return;
  }

  const rolloutOutcomeClient =
    deps.rolloutOutcomePrismaClient ?? (defaultPrisma as unknown as RolloutOutcomePrismaClient);

  const rollbackViaActions = deps.observeLive === true && deps.rollbackViaActions === true;
  if (rollbackViaActions && !deps.rolloutMonitor) throw new Error("Actions rollback requires the rollout monitor");

  const lockClient = deps.lockPrismaClient ?? (defaultPrisma as unknown as StandaloneLoopLockPrismaClient);
  const key = `${target.owner}/${target.repo}@${target.headSha}`;
  const lease = await acquireDeploymentLease(lockClient, target.owner, target.repo, deps.lockTtlMs ?? DEFAULT_LOCK_TTL_MS);
  if (!lease) {
    if (deps.observeLive === true) throw new Error("Another deployment or observation owns this repository");
    deps.logger.info({ key }, "standalone loop already running for repository, skipping redelivery");
    return;
  }

  // Create PENDING RolloutOutcome row (idempotent per installationId, commitSha)
  let pendingOutcome: RolloutOutcomeRecord | undefined;
  try {
    pendingOutcome = await createPendingRolloutOutcome(rolloutOutcomeClient, {
      owner: target.owner,
      repo: target.repo,
      commitSha: target.headSha,
      installationId: target.installationId,
      threshold: result.finalThreshold,
      window: result.finalWindow,
    });
    if (rollbackViaActions) {
      pendingOutcome = await rolloutOutcomeClient.rolloutOutcome.update({
        where: { id: pendingOutcome.id }, data: { rollbackExecutor: "github_actions" },
      });
    }
  } catch (error) {
    deps.logger.error({ error, sha: target.headSha }, "failed to create pending rollout outcome");
    if (rollbackViaActions) { await lease.release(); throw error; }
  }

  const buildAdapter = deps.rollbackAdapterFactory ?? defaultRollbackAdapterFactory;
  let adapter: RollbackAdapter;
  try { adapter = guardAdapter(buildAdapter(adapterConfig, target.baseSha), lease); }
  catch (error) { await lease.release(); throw error; }
  const firstTarget = adapterConfig.targets?.[0];
  const targetName =
    adapterConfig.target ??
    (typeof firstTarget === "string" ? firstTarget : firstTarget?.name) ??
    "";
  const startupGraceSeconds =
    (typeof firstTarget === "object" ? firstTarget?.startupGraceSeconds : undefined) ??
    adapterConfig.startupGraceSeconds ??
    60;

  // Builds can outlast the lock TTL; keep the lease alive during deployment too.
  const heartbeat = setInterval(() => {
    lease.assertHeld().catch((error: unknown) => {
      deps.logger.error({ error, key }, "failed to renew standalone loop lock heartbeat");
    });
  }, deps.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS);

  if (typeof adapter.applyRelease === "function") {
    let capturedRevision = false;
    try {
      if (adapter.getCurrentRevision) {
        const previousSha = await adapter.getCurrentRevision();
        if (!pendingOutcome) throw new Error("Cannot persist rollback baseline; deployment skipped");
        pendingOutcome = await rolloutOutcomeClient.rolloutOutcome.update({ where: { id: pendingOutcome.id }, data: { previousSha } });
        capturedRevision = true;
      }
      await adapter.applyRelease(target.headSha, targetName);
      if (pendingOutcome) {
        // Compilation/install time must not consume startup grace or observation time.
        const deployedAt = new Date();
        pendingOutcome = await rolloutOutcomeClient.rolloutOutcome.update({ where: { id: pendingOutcome.id }, data: { startedAt: deployedAt, deployedAt } });
      }
    } catch (error) {
      deps.logger.error({ error, key, sha: target.headSha }, "failed to apply commit on the host before soak");
      let rollbackVerified: boolean | undefined;
      let recoveryReason = "";
      if (capturedRevision && adapter.rollbackWithVerification && !rollbackViaActions) {
        try {
          rollbackVerified = (await adapter.rollbackWithVerification(targetName, startupGraceSeconds)).rollbackVerified;
          recoveryReason = rollbackVerified ? "; previous deployment restored and verified" : "; recovery health verification failed";
        } catch (recoveryError) {
          recoveryReason = `; recovery failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`;
          rollbackVerified = false;
        }
      }
      if (pendingOutcome) {
        try {
          if (rollbackViaActions && capturedRevision) {
            await rolloutOutcomeClient.rolloutOutcome.update({
              where: { id: pendingOutcome.id },
              data: { rollbackRequestedAt: new Date(), reason: `Deployment failed: ${error instanceof Error ? error.message : String(error)}` },
            });
          } else {
            const { finalizeRolloutOutcome } = await import("./adapters/rolloutOutcome.js");
            await finalizeRolloutOutcome(rolloutOutcomeClient, {
              id: pendingOutcome.id,
              status: "FAILED",
              rolledBack: rollbackVerified === true,
              rollbackVerified,
              reason: (error instanceof Error ? error.message : String(error)) + recoveryReason,
            });
          }
        } catch (finalizeError) {
          deps.logger.error({ error: finalizeError, key }, "failed to record applyRelease failure");
        }
      }
      await lease.release().catch((releaseError: unknown) => {
        deps.logger.error({ error: releaseError, key }, "failed to release standalone loop lock");
      });
      clearInterval(heartbeat);
      if (deps.observeLive === true) throw error;
      return;
    }
  }

  // Renewed on an interval for as long as the loop runs, so a live loop's lock never goes
  // stale and gets reclaimed out from under it -- only a holder that stops renewing
  // (crashed, or the process died) leaves a lock that eventually becomes reclaimable.
  // If a background monitor worker is attached and pendingOutcome exists, delegate monitoring to it
  if (deps.rolloutMonitor && pendingOutcome) {
    const monitorPromise = deps.rolloutMonitor.enqueue(pendingOutcome, adapter, targetName, startupGraceSeconds);
    if (monitorPromise) {
      void monitorPromise
        .catch((error: unknown) => {
          deps.logger.error({ error, key }, "rollout monitor failed");
        })
        .finally(() => {
          clearInterval(heartbeat);
          lease.release().catch((error: unknown) => {
            deps.logger.error({ error, key }, "failed to release standalone loop lock");
          });
        });
      return;
    }
  }

  const loopRunner = deps.standaloneLoopRunner ?? runStandaloneLoop;

  void loopRunner(target.headSha, adapter, result, targetName)
    .then(async (loopResult) => {
      try {
        if (pendingOutcome) {
          const { finalizeRolloutOutcome } = await import("./adapters/rolloutOutcome.js");
          await finalizeRolloutOutcome(rolloutOutcomeClient, {
            id: pendingOutcome.id,
            status: loopResult.rolledBack ? "ROLLED_BACK" : "SUCCESS",
            finalErrorRate: loopResult.finalErrorRate,
            rolledBack: loopResult.rolledBack,
            reason: loopResult.rolledBack ? "Threshold breach during standalone loop" : "Window completed successfully",
          });
        }
      } catch (error) {
        deps.logger.error({ error, key }, "failed to record rollout outcome");
      }
    })
    .catch((error: unknown) => {
      deps.logger.error({ error, key }, "standalone rollback loop failed");
    })
    .finally(() => {
      clearInterval(heartbeat);
      lease.release().catch((error: unknown) => {
        // Non-fatal: the lock will still expire via TTL and become reclaimable, just not
        // immediately. Logged for visibility, not left as an unhandled rejection.
        deps.logger.error({ error, key }, "failed to release standalone loop lock");
      });
    });
}
