import { acquireDiff } from "./adapters/github/diffAcquisition.js";
import type { GitHubApiClient } from "./adapters/github/githubApiClient.js";
import type { InstallationTokenClient } from "./adapters/github/installationTokenClient.js";
import type { DeployTarget } from "./adapters/github/webhookPayload.js";
import { DockerComposeAdapter } from "./adapters/dockerCompose.js";
import { KubectlAdapter } from "./adapters/kubectl.js";
import { runStandaloneLoop } from "./adapters/loop.js";
import type { RollbackAdapter } from "./adapters/rollbackAdapter.js";
import type { CarfConfig } from "./config/carfConfigSchema.js";
import { mergeThresholdConfig } from "./config/mergeThresholdConfig.js";
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
   * Testable seam; defaults to building a `KubectlAdapter` for `kind: "kubernetes"` or a
   * `DockerComposeAdapter` for `kind: "dockerCompose"` (using `baseSha` as the previous
   * image tag -- see `DockerComposeAdapter`'s doc comment on the `IMAGE_TAG` convention
   * this assumes).
   */
  rollbackAdapterFactory?: (adapterConfig: AdapterConfig, baseSha: string) => RollbackAdapter;
  /** Testable seam; defaults to the real runStandaloneLoop. */
  standaloneLoopRunner?: typeof runStandaloneLoop;
}

function defaultRollbackAdapterFactory(adapterConfig: AdapterConfig, baseSha: string): RollbackAdapter {
  if (adapterConfig.kind === "kubernetes") {
    return new KubectlAdapter();
  }
  // kind === "dockerCompose": no .carf.yml field carries a previous image tag (it would be
  // stale the moment a new commit lands anyway, since "previous" changes every deploy) --
  // baseSha (the commit before this push) is used instead, on the documented assumption
  // that the deployment pipeline tags images by commit SHA. See issue #50.
  return new DockerComposeAdapter(baseSha);
}

// Process-local only. Guards against GitHub's webhook redelivery starting a second
// concurrent Standalone rollback loop for the same commit. Does NOT survive a process
// restart and does NOT protect against more than one core-api instance running at once
// -- see docs/superpowers/specs/2026-08-24-composition-root-design.md, section 2
// ("Explicitly out of scope"). Deferred until there's real multi-instance pressure.
const activeLoops = new Set<string>();

function loopKey(owner: string, repo: string, sha: string): string {
  return `${owner}/${repo}@${sha}`;
}

/**
 * Composition root for a validated webhook DeployTarget: exchanges the installation ID
 * for a token, fetches the diff from GitHub, runs it through processCommit() (classify +
 * persist + compute threshold), then branches on .carf.yml's `mode`:
 *   - Augment (or no mode / no .carf.yml at all): stops here. GET /v1/threshold
 *     (src/routes/threshold.ts) serves the persisted result separately.
 *   - Standalone with adapter.kind "kubernetes" or "dockerCompose": additionally kicks
 *     off runStandaloneLoop() in the background (not awaited -- the loop can run for the
 *     full threshold window, up to DEFAULT_CONFIG's largest baseWindow, which would hang
 *     the webhook's HTTP response if awaited).
 *   - Standalone with no adapter configured at all: logs an error and skips the loop.
 *     processCommit()'s result has already persisted successfully -- this is a partial
 *     success, not a failure of the webhook itself.
 */
export async function handleWebhookCommit(target: DeployTarget, deps: WebhookOrchestratorDeps): Promise<void> {
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

  // dockerCompose's rollback tag is derived from baseSha (see defaultRollbackAdapterFactory),
  // which is only safe to treat as "what's currently deployed" for a push event -- a
  // pull_request's baseSha is the PR's base branch tip, not necessarily anything ever
  // actually deployed. kubernetes's KubectlAdapter doesn't use baseSha, so it's unaffected.
  if (adapterConfig.kind === "dockerCompose" && target.event !== "push") {
    deps.logger.error(
      { adapter: adapterConfig, event: target.event },
      "dockerCompose adapter requires a push event to safely derive the previous image tag from baseSha"
    );
    return;
  }

  const key = loopKey(target.owner, target.repo, target.headSha);
  if (activeLoops.has(key)) {
    deps.logger.info({ key }, "standalone loop already running for this commit, skipping redelivery");
    return;
  }
  activeLoops.add(key);

  const buildAdapter = deps.rollbackAdapterFactory ?? defaultRollbackAdapterFactory;
  const adapter = buildAdapter(adapterConfig, target.baseSha);
  const loopRunner = deps.standaloneLoopRunner ?? runStandaloneLoop;

  void loopRunner(target.headSha, adapter, result, adapterConfig.target)
    .catch((error: unknown) => {
      deps.logger.error({ error, key }, "standalone rollback loop failed");
    })
    .finally(() => {
      activeLoops.delete(key);
    });
}
