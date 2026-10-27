import {
  CARF_SECRET_NAME,
  CARF_WORKFLOW_PATH,
  CARF_WORKFLOW_VERSION,
  checkWorkflowContent,
  inspectExistingWorkflow,
  renderCarfWorkflow,
  workflowsEqual,
  InvalidWorkflowInputError,
  isPrivateHostUrl,
} from "./githubActionsWorkflow";

const PRIVATE_URL_MESSAGE = (url: string) =>
  `The CARF API URL "${url}" is a local/private address that GitHub-hosted runners cannot reach. Set CORE_API_PUBLIC_URL on the dashboard to the public HTTPS URL of the CARF API, restart it, then run Fully Integrate again.`;
import { resolveAugmentIntegration, type RepoConfigLookupInput } from "./deploymentMode";
import { resolveRepoMode } from "./deploymentMode";
import { resolveFromLegacy } from "./capabilities";
import { pm2FieldsFromStoredConfig } from "./connectionLookup";
import { GitHubApiError } from "../adapters/github/repoContentsClient";
import type * as GitHubClient from "../adapters/github/repoContentsClient";

/**
 * GitHubActionsIntegrationService: turns the GitHub Actions Augment integration into an
 * automatic one. Uses the CARF GitHub App installation (never a PAT) to commit
 * `.github/workflows/carf.yml`, configure the `CARF_API_KEY` Actions secret, and verify the
 * result. All GitHub/CARF I/O is injected so the whole flow is unit-testable, and nothing
 * secret (installation token, API key) is ever placed in a return value, error, or log.
 */

export const GITHUB_ACTIONS_INTEGRATION = "github-actions";

export type IntegrationStatus = "not_configured" | "configuring" | "ready" | "needs_attention" | "failed";

export type IntegrationErrorCode =
  | "not_augment"
  | "wrong_integration"
  | "not_installed"
  | "repo_inaccessible"
  | "insufficient_permission"
  | "branch_protected"
  | "workflow_not_managed"
  | "secret_failed"
  | "rate_limited"
  | "carf_unavailable"
  | "invalid_configuration"
  | "github_unavailable";

const HTTP_STATUS: Record<IntegrationErrorCode, number> = {
  not_augment: 409,
  wrong_integration: 409,
  not_installed: 424,
  repo_inaccessible: 404,
  insufficient_permission: 403,
  branch_protected: 409,
  workflow_not_managed: 409,
  secret_failed: 502,
  rate_limited: 429,
  carf_unavailable: 502,
  invalid_configuration: 400,
  github_unavailable: 502,
};

/** Error whose `message` is safe and actionable to show to a user. */
export class IntegrationError extends Error {
  readonly httpStatus: number;
  constructor(
    public readonly code: IntegrationErrorCode,
    message: string
  ) {
    super(message);
    this.name = "IntegrationError";
    this.httpStatus = HTTP_STATUS[code];
  }
}

export interface IntegrationRecord {
  status: string;
  branch: string | null;
  workflowPath: string | null;
  workflowVersion: number | null;
  configuredAt: Date | null;
  lastVerifiedAt: Date | null;
  lastSyncAt: Date | null;
  lastPolicyAt: Date | null;
  lastCommitSha: string | null;
  lastError: string | null;
}

export type IntegrationUpdate = Partial<IntegrationRecord>;

export interface IntegrationKey {
  installationId: string;
  owner: string;
  repo: string;
}

export interface IntegrationStore {
  find(key: IntegrationKey): Promise<IntegrationRecord | null>;
  upsert(key: IntegrationKey, data: IntegrationUpdate): Promise<IntegrationRecord>;
}

/** Narrow Prisma surface used by `createPrismaIntegrationStore` -- keeps tests free of a real DB. */
export interface RepoIntegrationPrismaClient {
  repoIntegration?: {
    findUnique(args: {
      where: { installationId_owner_repo_integration: IntegrationKey & { integration: string } };
    }): Promise<IntegrationRecord | null>;
    upsert(args: {
      where: { installationId_owner_repo_integration: IntegrationKey & { integration: string } };
      create: IntegrationKey & { integration: string } & IntegrationUpdate;
      update: IntegrationUpdate;
    }): Promise<IntegrationRecord>;
  };
}

export function createPrismaIntegrationStore(
  prisma: RepoIntegrationPrismaClient,
  onSchemaError?: () => Promise<void>
): IntegrationStore {
  const where = (key: IntegrationKey) => ({
    installationId_owner_repo_integration: { ...key, integration: GITHUB_ACTIONS_INTEGRATION },
  });
  return {
    find: async (key) => {
      try {
        if (!prisma?.repoIntegration?.findUnique) return null;
        return await prisma.repoIntegration.findUnique({ where: where(key) });
      } catch {
        if (onSchemaError) {
          try {
            await onSchemaError();
            if (prisma?.repoIntegration?.findUnique) {
              return await prisma.repoIntegration.findUnique({ where: where(key) });
            }
          } catch {
            // fall through to null
          }
        }
        return null;
      }
    },
    upsert: async (key, data) => {
      try {
        if (!prisma?.repoIntegration?.upsert) {
          if (onSchemaError) await onSchemaError();
        }
        return await prisma.repoIntegration!.upsert({
          where: where(key),
          create: { ...key, integration: GITHUB_ACTIONS_INTEGRATION, ...data },
          update: data,
        });
      } catch (err) {
        if (onSchemaError) {
          await onSchemaError();
          return await prisma.repoIntegration!.upsert({
            where: where(key),
            create: { ...key, integration: GITHUB_ACTIONS_INTEGRATION, ...data },
            update: data,
          });
        }
        throw err;
      }
    },
  };
}

export interface PolicyProbeResult {
  status: number;
  body?: {
    threshold?: number;
    window?: number;
    changeVector?: Record<string, number>;
  };
}

export interface ServiceDeps {
  store: IntegrationStore;
  github: typeof GitHubClient;
  /** Mints a short-lived installation token (never persisted or returned). */
  mintInstallationToken(installationId: string): Promise<string>;
  /** Signs a GitHub App JWT for app-level reads (installation permissions). */
  signAppJwt(): string;
  /** Returns the installation-scoped CARF API key; used only to seed the GitHub secret and probe policy. */
  getApiKey(): Promise<string>;
  /** Public CARF API origin written into the workflow. */
  coreApiUrl: string;
  probePolicy(args: { owner: string; repo: string; sha: string; apiKey: string }): Promise<PolicyProbeResult>;
  /** Asks CARF to classify recent commits on the branch (policy test only; no rollout side effects). */
  refreshCommits(args: { owner: string; repo: string; branch: string; apiKey: string }): Promise<void>;
  /** Calls the policy endpoint through the public URL without following redirects, as a GitHub runner would. */
  probePublicPolicy?(args: { owner: string; repo: string; sha: string; apiKey: string }): Promise<{ status: number }>;
  now?(): Date;
  logError?(message: string, detail: unknown): void;
}

export interface IntegrationContext {
  installationId: string;
  owner: string;
  repo: string;
  connection: RepoConfigLookupInput;
}

export interface PolicyTestResult {
  commit: string;
  changeVector: Record<string, number>;
  threshold: number;
  window: number;
}

export interface VerificationCheck {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
}

/** Everything returned to the browser. Contains no tokens, keys, or secret values by construction. */
export interface IntegrationResult {
  status: IntegrationStatus;
  integration: "github-actions";
  repository: string;
  installationId: string;
  branch: string | null;
  workflowPath: string;
  workflowVersion: number | null;
  configuredAt: string | null;
  lastVerifiedAt: string | null;
  lastSyncAt: string | null;
  lastPolicyAt: string | null;
  lastCommitSha: string | null;
  lastError: string | null;
  checks?: VerificationCheck[];
  policy?: PolicyTestResult | null;
}

const REQUIRED_PERMISSIONS: Array<{ name: string; label: string }> = [
  { name: "contents", label: "Contents" },
  { name: "workflows", label: "Workflows" },
  { name: "secrets", label: "Secrets" },
];

function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

export class GitHubActionsIntegrationService {
  constructor(private readonly deps: ServiceDeps) {}

  private now(): Date {
    return this.deps.now ? this.deps.now() : new Date();
  }

  private key(ctx: IntegrationContext): IntegrationKey {
    return { installationId: ctx.installationId, owner: ctx.owner, repo: ctx.repo };
  }

  private assertEligible(ctx: IntegrationContext): void {
    if (resolveAugmentIntegration(ctx.connection) !== "github-actions") {
      throw new IntegrationError("wrong_integration", "This repository's deployment integration is not GitHub Actions.");
    }
  }

  private managesPm2(ctx: IntegrationContext): boolean {
    return resolveRepoMode(ctx.connection) === "standalone" && resolveFromLegacy(ctx.connection).runtimeAdapter === "pm2";
  }

  private toResult(
    ctx: IntegrationContext,
    record: IntegrationRecord | null,
    extra: Pick<IntegrationResult, "checks" | "policy"> = {}
  ): IntegrationResult {
    return {
      status: (record?.status as IntegrationStatus | undefined) ?? "not_configured",
      integration: "github-actions",
      repository: `${ctx.owner}/${ctx.repo}`,
      installationId: ctx.installationId,
      branch: record?.branch ?? null,
      workflowPath: record?.workflowPath ?? CARF_WORKFLOW_PATH,
      workflowVersion: record?.workflowVersion ?? null,
      configuredAt: iso(record?.configuredAt),
      lastVerifiedAt: iso(record?.lastVerifiedAt),
      lastSyncAt: iso(record?.lastSyncAt),
      lastPolicyAt: iso(record?.lastPolicyAt),
      lastCommitSha: record?.lastCommitSha ?? null,
      lastError: record?.lastError ?? null,
      ...extra,
    };
  }

  /** Converts any thrown value into an IntegrationError; logs raw detail server-side only. */
  private normalize(error: unknown, ctx: IntegrationContext): IntegrationError {
    if (error instanceof IntegrationError) return error;
    if (error instanceof GitHubApiError) {
      this.deps.logError?.(`[github-actions-integration] ${ctx.owner}/${ctx.repo} GitHub ${error.code} (${error.status})`, error.detail);
      return new IntegrationError(error.code, error.message);
    }
    if (error instanceof InvalidWorkflowInputError) {
      return new IntegrationError("invalid_configuration", error.message);
    }
    this.deps.logError?.(`[github-actions-integration] ${ctx.owner}/${ctx.repo} unexpected failure`, error);
    return new IntegrationError("github_unavailable", "The integration failed unexpectedly. Check the CARF server logs and try again.");
  }

  async getStatus(ctx: IntegrationContext): Promise<IntegrationResult> {
    return this.toResult(ctx, await this.deps.store.find(this.key(ctx)));
  }

  /** Idempotent install: safe to run repeatedly. */
  async install(ctx: IntegrationContext): Promise<IntegrationResult> {
    return this.run(ctx);
  }

  /** Re-runs the full install (branch, workflow, secret) and verification, clearing any error state. */
  async reconfigure(ctx: IntegrationContext): Promise<IntegrationResult> {
    return this.run(ctx);
  }

  private async run(ctx: IntegrationContext): Promise<IntegrationResult> {
    this.assertEligible(ctx);
    const key = this.key(ctx);
    await this.deps.store.upsert(key, { status: "configuring", lastError: null });

    try {
      if (isPrivateHostUrl(this.deps.coreApiUrl)) {
        throw new IntegrationError("invalid_configuration", PRIVATE_URL_MESSAGE(this.deps.coreApiUrl));
      }
      await this.assertAppPermissions(ctx);
      const token = await this.deps.mintInstallationToken(ctx.installationId);
      const gh = this.deps.github;
      const repoInfo = await gh.getRepository(token, ctx.owner, ctx.repo);
      const branch = repoInfo.defaultBranch;

      const managedPm2 = this.managesPm2(ctx);
      const pm2Setup = pm2FieldsFromStoredConfig(ctx.connection.storedConfig);
      if (managedPm2 && pm2Setup.layout === "git" && !pm2Setup.buildCommand?.trim()) {
        throw new IntegrationError("invalid_configuration", "Set the PM2 build command before integrating. For Sahaay use npm ci && npm run build in /opt/sahaay/my-app; it runs during deployment and rollback. Apps without a build step can use true.");
      }
      if (managedPm2 && !await gh.hasDeploymentCi(token, ctx.owner, ctx.repo, undefined, this.ciWorkflowName(ctx))) {
        throw new IntegrationError("invalid_configuration", "Automatic PM2 deployment requires an active GitHub Actions workflow named CI that runs on pushes to the deployment branch. Add it before integrating.");
      }
      const desired = renderCarfWorkflow({ coreApiUrl: this.deps.coreApiUrl, branch, managedPm2, ciWorkflowName: this.ciWorkflowName(ctx) });
      const existing = await gh.getFile(token, ctx.owner, ctx.repo, CARF_WORKFLOW_PATH, branch);
      const ownership = inspectExistingWorkflow(existing?.content ?? null);

      if (ownership.kind === "foreign") {
        throw new IntegrationError(
          "workflow_not_managed",
          `${CARF_WORKFLOW_PATH} already exists but is not managed by CARF, so it was left untouched. Rename or remove it, or move your workflow to a different file, then run Fully Integrate again.`
        );
      }

      if (!existing || !workflowsEqual(existing.content, desired)) {
        await gh.putFile(token, ctx.owner, ctx.repo, {
          path: CARF_WORKFLOW_PATH,
          content: desired,
          message: existing ? "chore(carf): update CARF Actions workflow" : "chore(carf): add CARF Actions workflow",
          branch,
          ...(existing ? { sha: existing.sha } : {}),
        });
      }

      try {
        const apiKey = await this.deps.getApiKey();
        await gh.setActionsSecret(token, ctx.owner, ctx.repo, CARF_SECRET_NAME, apiKey);
      } catch (error) {
        if (error instanceof GitHubApiError && error.code !== "insufficient_permission") {
          this.deps.logError?.(`[github-actions-integration] secret configuration failed for ${ctx.owner}/${ctx.repo}`, error.detail);
          throw new IntegrationError("secret_failed", "CARF could not configure the CARF_API_KEY repository secret. Try again, or check the GitHub App's Secrets permission.");
        }
        throw error;
      }

      const now = this.now();
      await this.deps.store.upsert(key, {
        status: "configuring",
        branch,
        workflowPath: CARF_WORKFLOW_PATH,
        workflowVersion: managedPm2 ? CARF_WORKFLOW_VERSION : 1,
        configuredAt: (await this.deps.store.find(key))?.configuredAt ?? now,
        lastSyncAt: now,
        lastError: null,
      });
      return await this.verify(ctx);
    } catch (error) {
      const normalized = this.normalize(error, ctx);
      await this.deps.store
        .upsert(key, { status: "failed", lastError: normalized.message })
        .catch((e) => this.deps.logError?.("[github-actions-integration] could not persist failure state", e));
      throw normalized;
    }
  }

  /** Read-only verification plus a safe policy test against the branch HEAD. Deploys and rolls back nothing. */
  async verify(ctx: IntegrationContext): Promise<IntegrationResult> {
    this.assertEligible(ctx);
    const key = this.key(ctx);
    try {
      const record = await this.deps.store.find(key);
      const token = await this.deps.mintInstallationToken(ctx.installationId);
      const gh = this.deps.github;
      const repoInfo = await gh.getRepository(token, ctx.owner, ctx.repo);
      const branch = record?.branch ?? repoInfo.defaultBranch;
      const checks: VerificationCheck[] = [
        { id: "repository-access", label: "GitHub App can access the repository", ok: true },
        { id: "deployment-integration", label: "Repository deployment integration is GitHub Actions", ok: true },
      ];
      if (this.managesPm2(ctx)) {
        const setup = pm2FieldsFromStoredConfig(ctx.connection.storedConfig);
        checks.push({ id: "pm2-build", label: "PM2 deployment and rollback build command is configured", ok: setup.layout !== "git" || Boolean(setup.buildCommand?.trim()) });
        checks.push({ id: "ci-workflow", label: "Active CI workflow is available for deployment", ok: await gh.hasDeploymentCi(token, ctx.owner, ctx.repo, undefined, this.ciWorkflowName(ctx)), detail: "PM2 deploys only after the required CI workflow succeeds for a push to the deployment branch." });
      }

      const file = await gh.getFile(token, ctx.owner, ctx.repo, CARF_WORKFLOW_PATH, branch);
      checks.push({ id: "workflow-exists", label: "Workflow file exists", ok: Boolean(file), ...(file ? {} : { detail: `${CARF_WORKFLOW_PATH} not found on ${branch}` }) });
      if (file) {
        const c = checkWorkflowContent(file.content, this.deps.coreApiUrl);
        checks.push({ id: "workflow-marker", label: "Workflow is CARF-managed", ok: c.hasMarker });
        checks.push({
          id: "workflow-integration",
          label: "Workflow targets the CARF Augment policy endpoint",
          ok: c.usesAugmentEndpoint && c.referencesCarfApi,
        });
        checks.push({ id: "workflow-secret", label: "Workflow references the CARF secret", ok: c.referencesSecret });
        if (this.managesPm2(ctx)) {
          checks.push({ id: "ci-gate", label: "Workflow waits for successful CI", ok: c.waitsForCi });
          checks.push({ id: "deployment", label: "Workflow triggers CARF PM2 deployment", ok: c.triggersDeployment });
          checks.push({ id: "rollback-job", label: "GitHub Actions executes and verifies rollback", ok: c.executesRollback, detail: c.executesRollback ? "A dedicated rollback job restores the saved revision." : "Run Reconfigure to install the rollback job." });
        }
        const urlMatch = file.content.match(/CARF_API_URL:\s*(\S+)/);
        const workflowUrl = urlMatch?.[1] ?? "";
        const reachable = Boolean(workflowUrl) && !isPrivateHostUrl(workflowUrl);
        checks.push({
          id: "workflow-reachable",
          label: "Workflow CARF API URL is reachable from GitHub runners",
          ok: reachable,
          ...(reachable ? {} : { detail: workflowUrl ? `${workflowUrl} is a local/private address; set CARF_API_URL to the public CARF API URL (run Reconfigure)` : "CARF_API_URL not found in workflow" }),
        });
      }

      let secretOk = false;
      try {
        secretOk = await gh.actionsSecretExists(token, ctx.owner, ctx.repo, CARF_SECRET_NAME);
      } catch (error) {
        const normalized = this.normalize(error, ctx);
        if (normalized.code === "rate_limited") throw normalized;
      }
      checks.push({ id: "secret-configured", label: "Repository secret is configured", ok: secretOk });

      const head = await gh.getHeadSha(token, ctx.owner, ctx.repo, branch);
      const { policy, detail } = await this.testPolicy(ctx, head, branch);
      checks.push({ id: "policy", label: "CARF can analyze the current commit", ok: Boolean(policy), ...(detail ? { detail } : {}) });

      if (this.deps.probePublicPolicy) {
        let publicDetail: string | undefined;
        let isError = false;
        try {
          const apiKey = await this.deps.getApiKey();
          const res = await this.deps.probePublicPolicy({ owner: ctx.owner, repo: ctx.repo, sha: head, apiKey });
          if (res.status >= 300 && res.status < 400) {
            publicDetail = `${this.deps.coreApiUrl} answered HTTP ${res.status} (a redirect, usually to the dashboard login). Route /v1/* on that host to core-api, or point CORE_API_PUBLIC_URL at a host that does.`;
            isError = true;
          } else if (res.status >= 500) {
            publicDetail = `${this.deps.coreApiUrl} answered HTTP ${res.status}`;
            isError = true;
          }
        } catch (error) {
          const cause = (error as { cause?: { code?: string; message?: string } })?.cause;
          const reason = cause?.code ?? cause?.message ?? (error instanceof Error ? error.message : "unknown error");
          this.deps.logError?.(`[github-actions-integration] public probe failed for ${ctx.owner}/${ctx.repo}`, error);
          publicDetail = `Notice: Server could not self-connect to ${this.deps.coreApiUrl} (${reason}). This usually indicates hairpin NAT / cloud loopback is not enabled on this host, but external GitHub runners may still connect fine.`;
          isError = false;
        }
        checks.push({
          id: "public-api-reachable",
          label: "CARF API is reachable at its public URL (as GitHub runners call it)",
          ok: !isError,
          ...(publicDetail ? { detail: publicDetail } : {}),
        });
      }

      const failed = checks.find((c) => !c.ok);
      const now = this.now();
      const saved = await this.deps.store.upsert(key, {
        status: failed ? "needs_attention" : "ready",
        branch,
        lastVerifiedAt: now,
        lastCommitSha: head,
        lastError: failed ? `${failed.label}${failed.detail ? `: ${failed.detail}` : ""}` : null,
        ...(policy ? { lastPolicyAt: now } : {}),
      });
      return this.toResult(ctx, saved, { checks, policy });
    } catch (error) {
      const normalized = this.normalize(error, ctx);
      await this.deps.store
        .upsert(key, { status: "failed", lastError: normalized.message })
        .catch((e) => this.deps.logError?.("[github-actions-integration] could not persist failure state", e));
      throw normalized;
    }
  }

  private async testPolicy(
    ctx: IntegrationContext,
    sha: string,
    branch: string
  ): Promise<{ policy: PolicyTestResult | null; detail?: string }> {
    try {
      const apiKey = await this.deps.getApiKey();
      let res = await this.deps.probePolicy({ owner: ctx.owner, repo: ctx.repo, sha, apiKey });
      if (res.status === 404) {
        await this.deps.refreshCommits({ owner: ctx.owner, repo: ctx.repo, branch, apiKey });
        res = await this.deps.probePolicy({ owner: ctx.owner, repo: ctx.repo, sha, apiKey });
      }
      if (res.status === 200 && res.body && typeof res.body.threshold === "number" && typeof res.body.window === "number") {
        return {
          policy: {
            commit: sha,
            changeVector: res.body.changeVector ?? {},
            threshold: res.body.threshold,
            window: res.body.window,
          },
        };
      }
      if (res.status === 401) return { policy: null, detail: "CARF rejected the installation credentials" };
      if (res.status === 404) return { policy: null, detail: "CARF has not classified the current commit yet" };
      return { policy: null, detail: `CARF policy endpoint returned HTTP ${res.status}` };
    } catch (error) {
      this.deps.logError?.(`[github-actions-integration] policy probe failed for ${ctx.owner}/${ctx.repo}`, error instanceof Error ? error.message : error);
      return { policy: null, detail: "CARF API is unavailable" };
    }
  }

  /** Removes the CARF-managed workflow and secret. Never touches a workflow CARF does not own. */
  async disable(ctx: IntegrationContext): Promise<IntegrationResult> {
    this.assertEligible(ctx);
    const key = this.key(ctx);
    try {
      const token = await this.deps.mintInstallationToken(ctx.installationId);
      const gh = this.deps.github;
      const record = await this.deps.store.find(key);
      const repoInfo = await gh.getRepository(token, ctx.owner, ctx.repo);
      const branch = record?.branch ?? repoInfo.defaultBranch;
      const file = await gh.getFile(token, ctx.owner, ctx.repo, CARF_WORKFLOW_PATH, branch);
      if (file && inspectExistingWorkflow(file.content).kind === "managed") {
        await gh.deleteFile(token, ctx.owner, ctx.repo, {
          path: CARF_WORKFLOW_PATH,
          message: "chore(carf): remove CARF Augment workflow",
          branch,
          sha: file.sha,
        });
        await gh.deleteActionsSecret(token, ctx.owner, ctx.repo, CARF_SECRET_NAME);
      }
      const saved = await this.deps.store.upsert(key, {
        status: "not_configured",
        workflowPath: null,
        workflowVersion: null,
        configuredAt: null,
        lastError: null,
      });
      return this.toResult(ctx, saved);
    } catch (error) {
      const normalized = this.normalize(error, ctx);
      await this.deps.store
        .upsert(key, { status: "failed", lastError: normalized.message })
        .catch((e) => this.deps.logError?.("[github-actions-integration] could not persist failure state", e));
      throw normalized;
    }
  }

  /** Canonical template for the "Advanced / Manual configuration" view. Contains no secret values. */
  private ciWorkflowName(ctx: IntegrationContext): string {
    const stored = ctx.connection.storedConfig as { ciWorkflowName?: unknown } | null;
    return typeof stored?.ciWorkflowName === "string" && stored.ciWorkflowName.trim() ? stored.ciWorkflowName : "CI";
  }

  async manualWorkflow(ctx: IntegrationContext): Promise<string> {
    try {
      const record = await this.deps.store.find(this.key(ctx));
      return renderCarfWorkflow({ coreApiUrl: this.deps.coreApiUrl, branch: record?.branch ?? "main", managedPm2: this.managesPm2(ctx), ciWorkflowName: this.ciWorkflowName(ctx) });
    } catch {
      return renderCarfWorkflow({ coreApiUrl: this.deps.coreApiUrl, branch: "main", managedPm2: this.managesPm2(ctx), ciWorkflowName: this.ciWorkflowName(ctx) });
    }
  }

  private async assertAppPermissions(ctx: IntegrationContext): Promise<void> {
    const permissions = await this.deps.github.getInstallationPermissions(this.deps.signAppJwt(), ctx.installationId);
    const missing = REQUIRED_PERMISSIONS.filter((p) => permissions[p.name] !== "write").map((p) => p.label);
    if (this.managesPm2(ctx) && !["read", "write"].includes(permissions.actions ?? "")) {
      throw new IntegrationError("insufficient_permission", "CI-gated PM2 deployment requires Actions: Read access for the CARF GitHub App. Update the app and accept the permissions on its installation.");
    }
    if (missing.length > 0) {
      throw new IntegrationError(
        "insufficient_permission",
        `GitHub Actions integration could not be installed because the CARF GitHub App is missing "Read and write" access for: ${missing.join(", ")}. Update the app's repository permissions on GitHub and accept the change on the installation.`
      );
    }
  }
}
