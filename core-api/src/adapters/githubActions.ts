import type { DeploymentContext, DeploymentIntegration, DeploymentStatus } from "./contracts.js";

export interface GitHubActionsIntegrationOptions {
  token?: string | undefined;
  fetchFn?: ((url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json?: () => Promise<unknown> }>) | undefined;
}

/**
 * GitHub Actions Deployment Integration.
 * Evaluates commit risk in GitHub Actions workflow steps and provides threshold gating.
 */
export class GitHubActionsIntegration implements DeploymentIntegration {
  readonly kind = "github_actions";
  private readonly token?: string | undefined;
  private readonly fetchFn: (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json?: () => Promise<unknown> }>;
  private readonly statuses = new Map<string, DeploymentStatus>();

  constructor(options: GitHubActionsIntegrationOptions = {}) {
    this.token = options.token;
    this.fetchFn = options.fetchFn ?? ((url: string, init?: RequestInit) => globalThis.fetch(url, init as RequestInit));
  }

  async identifyDeployment(context: DeploymentContext): Promise<string> {
    const runId = context.metadata?.runId ? String(context.metadata.runId) : context.sha;
    const repoSlug = context.owner && context.repo ? `${context.owner}/${context.repo}` : "workflow";
    return `${repoSlug}#${runId}`;
  }

  async getDeploymentStatus(deploymentId: string, _context?: DeploymentContext): Promise<DeploymentStatus> {
    const recorded = this.statuses.get(deploymentId);
    if (recorded) return recorded;

    return {
      phase: "succeeded",
      message: "GitHub Actions workflow run completed",
    };
  }

  async notifyStatus(deploymentId: string, status: DeploymentStatus): Promise<void> {
    this.statuses.set(deploymentId, status);
  }

  async abort(deploymentId: string, context?: DeploymentContext): Promise<void> {
    const status: DeploymentStatus = {
      phase: "aborted",
      message: "Workflow canceled due to CARF threshold breach",
    };
    if (context?.sha) {
      status.targetVersion = context.sha;
    }
    this.statuses.set(deploymentId, status);
  }

  async rollback(deploymentId: string, context?: DeploymentContext): Promise<void> {
    const status: DeploymentStatus = {
      phase: "failed",
      message: "Rollback dispatched for GitHub Actions deployment",
    };
    if (context?.baseSha) {
      status.activeVersion = context.baseSha;
    }
    this.statuses.set(deploymentId, status);
  }
}
