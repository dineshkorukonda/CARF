import { acquireDiff } from "./adapters/github/diffAcquisition.js";
import type { GitHubApiClient } from "./adapters/github/githubApiClient.js";
import type { InstallationTokenClient } from "./adapters/github/installationTokenClient.js";
import type { DeployTarget } from "./adapters/github/webhookPayload.js";
import { DockerComposeAdapter } from "./adapters/dockerCompose.js";
import { DockerSwarmAdapter } from "./adapters/dockerSwarm.js";
import { GitOpsAdapter } from "./adapters/gitops.js";
import { KubectlAdapter } from "./adapters/kubectl.js";
import { runStandaloneLoop } from "./adapters/loop.js";
import { PM2Adapter } from "./adapters/pm2.js";
import type { RollbackAdapter } from "./adapters/rollbackAdapter.js";
import { recordRolloutOutcome, type RolloutOutcomePrismaClient } from "./adapters/rolloutOutcome.js";
import { ensureApiKeyForInstallation, type InstallationApiKeyPrismaClient } from "./auth/installationApiKeyService.js";
import {
  acquireLock,
  DEFAULT_HEARTBEAT_INTERVAL_MS,
  DEFAULT_LOCK_TTL_MS,
  releaseLock,
  renewLock,
  type StandaloneLoopLockPrismaClient,
} from "./adapters/standaloneLoopLock.js";
import type { CarfConfig } from "./config/carfConfigSchema.js";
import { env } from "./config/env.js";
import { mergeThresholdConfig } from "./config/mergeThresholdConfig.js";
import { prisma as defaultPrisma } from "./db/client.js";
import { NoSignalError, processCommit, type PipelinePrismaClient } from "./pipeline.js";

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
  /**
   * Testable seam; defaults to building a `KubectlAdapter` for `kind: "kubernetes"`, a
   * `DockerComposeAdapter` for `kind: "dockerCompose"`, a `PM2Adapter` for `kind: "pm2"`, a
   * `GitOpsAdapter` for `kind: "gitops"`, or a `DockerSwarmAdapter` for `kind:
   * "dockerSwarm"` (the first three of those using `baseSha` as the previous image tag /
   * release SHA / revision -- see their doc comments for the convention this assumes).
   */
  rollbackAdapterFactory?: (adapterConfig: AdapterConfig, baseSha: string) => RollbackAdapter;
  /** Testable seam; defaults to the real runStandaloneLoop. */
  standaloneLoopRunner?: typeof runStandaloneLoop;
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
}

function defaultRollbackAdapterFactory(adapterConfig: AdapterConfig, baseSha: string): RollbackAdapter {
  if (adapterConfig.kind === "kubernetes") {
    return new KubectlAdapter();
  }
  if (adapterConfig.kind === "pm2") {
    // Same "no static config field for the previous value" reasoning as dockerCompose
    // below -- baseSha stands in for the previous release SHA. See issue #51.
    return new PM2Adapter(baseSha);
  }
  if (adapterConfig.kind === "gitops") {
    // Same "no static config field for the previous value" reasoning as dockerCompose/pm2
    // -- baseSha stands in for the previous Argo CD deployment revision. See issue #52.
    return new GitOpsAdapter(baseSha, env.argoCdBaseUrl(), env.argoCdAuthToken());
  }
  if (adapterConfig.kind === "dockerSwarm") {
    // Swarm tracks the previous spec itself, like kubectl -- no baseSha needed. See issue #53.
    return new DockerSwarmAdapter();
  }
  // kind === "dockerCompose": no .carf.yml field carries a previous image tag (it would be
  // stale the moment a new commit lands anyway, since "previous" changes every deploy) --
  // baseSha (the commit before this push) is used instead, on the documented assumption
  // that the deployment pipeline tags images by commit SHA. See issue #50.
  return new DockerComposeAdapter(baseSha);
}


/**
 * Composition root for a validated webhook DeployTarget: exchanges the installation ID
 * for a token, fetches the diff from GitHub, runs it through processCommit() (classify +
 * persist + compute threshold), then branches on .carf.yml's `mode`:
 *   - Augment (or no mode / no .carf.yml at all): stops here. GET /v1/threshold
 *     (src/routes/threshold.ts) serves the persisted result separately.
 *   - Standalone with adapter.kind "kubernetes", "dockerCompose", "pm2", "gitops", or
 *     "dockerSwarm": additionally kicks off runStandaloneLoop() in the background (not
 *     awaited -- the loop can run for the full threshold window, up to DEFAULT_CONFIG's
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
  const changedFiles = await acquireDiff(
    deps.githubApiClient,
    target.owner,
    target.repo,
    target.baseSha,
    target.headSha,
    token
  );

  const repoSlug = `${target.owner}/${target.repo}`;
  let result;
  try {
    result = await processCommit(target.headSha, repoSlug, changedFiles, {
      prismaClient: deps.prismaClient,
      baseSha: target.baseSha,
      installationId: target.installationId,
      thresholdConfig: mergeThresholdConfig(deps.carfConfig?.threshold),
      classificationRules: deps.carfConfig?.classification?.rules ?? [],
    });
  } catch (error) {
    if (error instanceof NoSignalError) {
      deps.logger.info(
        { sha: target.headSha, fileCount: changedFiles.length },
        "no classification signal, skipping threshold"
      );
      return;
    }
    throw error;
  }

  const carfConfig = deps.carfConfig;
  if (carfConfig?.mode !== "standalone") {
    return;
  }

  const adapterConfig = carfConfig.adapter;
  if (!adapterConfig) {
    deps.logger.error(
      { adapter: adapterConfig },
      "standalone mode configured but no adapter specified"
    );
    return;
  }

  // dockerCompose/pm2/gitops's rollback tag/release/revision is derived from baseSha (see
  // defaultRollbackAdapterFactory), which is only safe to treat as "what's currently
  // deployed" for a push event -- a pull_request's baseSha is the PR's base branch tip,
  // not necessarily anything ever actually deployed. kubernetes's KubectlAdapter and
  // dockerSwarm's DockerSwarmAdapter don't use baseSha, so they're unaffected.
  if (
    (adapterConfig.kind === "dockerCompose" || adapterConfig.kind === "pm2" || adapterConfig.kind === "gitops") &&
    target.event !== "push"
  ) {
    deps.logger.error(
      { adapter: adapterConfig, event: target.event },
      `${adapterConfig.kind} adapter requires a push event to safely derive the previous image tag/release from baseSha`
    );
    return;
  }

  const lockClient = deps.lockPrismaClient ?? (defaultPrisma as unknown as StandaloneLoopLockPrismaClient);
  const ttlMs = deps.lockTtlMs ?? DEFAULT_LOCK_TTL_MS;
  const heartbeatIntervalMs = deps.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  const key = `${target.owner}/${target.repo}@${target.headSha}`;

  const acquired = await acquireLock(lockClient, target.owner, target.repo, target.headSha, ttlMs);
  if (!acquired) {
    deps.logger.info({ key }, "standalone loop already running for this commit (durable lock held), skipping redelivery");
    return;
  }

  const buildAdapter = deps.rollbackAdapterFactory ?? defaultRollbackAdapterFactory;
  const adapter = buildAdapter(adapterConfig, target.baseSha);
  const loopRunner = deps.standaloneLoopRunner ?? runStandaloneLoop;

  // Renewed on an interval for as long as the loop runs, so a live loop's lock never goes
  // stale and gets reclaimed out from under it -- only a holder that stops renewing
  // (crashed, or the process died) leaves a lock that eventually becomes reclaimable.
  const heartbeat = setInterval(() => {
    renewLock(lockClient, target.owner, target.repo, target.headSha).catch((error: unknown) => {
      // Not fatal to the loop itself -- a missed heartbeat just brings the lock closer to
      // TTL expiry. Logged so a persistently-failing DB is visible, not silently swallowed
      // (and, critically, not left as an unhandled rejection that would crash the process).
      deps.logger.error({ error, key }, "failed to renew standalone loop lock heartbeat");
    });
  }, heartbeatIntervalMs);

  const rolloutOutcomeClient =
    deps.rolloutOutcomePrismaClient ?? (defaultPrisma as unknown as RolloutOutcomePrismaClient);

  void loopRunner(target.headSha, adapter, result, adapterConfig.target)
    .then(async (loopResult) => {
      try {
        await recordRolloutOutcome(rolloutOutcomeClient, {
          owner: target.owner,
          repo: target.repo,
          sha: target.headSha,
          installationId: target.installationId,
          rolledBack: loopResult.rolledBack,
          finalErrorRate: loopResult.finalErrorRate,
          durationMs: loopResult.durationMs,
        });
      } catch (error) {
        // Distinct log message from the loop-failure case below -- the loop itself
        // succeeded, only recording its outcome failed. Not fatal to anything else.
        deps.logger.error({ error, key }, "failed to record rollout outcome");
      }
    })
    .catch((error: unknown) => {
      deps.logger.error({ error, key }, "standalone rollback loop failed");
    })
    .finally(() => {
      clearInterval(heartbeat);
      releaseLock(lockClient, target.owner, target.repo, target.headSha).catch((error: unknown) => {
        // Non-fatal: the lock will still expire via TTL and become reclaimable, just not
        // immediately. Logged for visibility, not left as an unhandled rejection.
        deps.logger.error({ error, key }, "failed to release standalone loop lock");
      });
    });
}
