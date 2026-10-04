import type { DeploymentContext, DeploymentIntegration, DeploymentStatus } from "./contracts.js";

export interface GenericHttpIntegrationOptions {
  webhookUrl?: string;
  fetchFn?: (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json?: () => Promise<unknown> }>;
}

/**
 * Generic HTTP / REST API Deployment Integration.
 * Allows any CI/CD pipeline (GitLab CI, Jenkins, CircleCI, Tekton, custom curl) to
 * interact with CARF for risk evaluation, threshold gating, and deployment status updates.
 */
export class GenericHttpIntegration implements DeploymentIntegration {
  readonly kind = "generic_http";
  private readonly webhookUrl?: string | undefined;
  private readonly fetchFn: (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json?: () => Promise<unknown> }>;
  private readonly statuses = new Map<string, DeploymentStatus>();

  constructor(options: GenericHttpIntegrationOptions = {}) {
    this.webhookUrl = options.webhookUrl;
    this.fetchFn = options.fetchFn ?? ((url: string, init?: RequestInit) => globalThis.fetch(url, init as RequestInit));
  }

  async identifyDeployment(context: DeploymentContext): Promise<string> {
    if (context.metadata?.deploymentId && typeof context.metadata.deploymentId === "string") {
      return context.metadata.deploymentId;
    }
    const repoSlug = context.owner && context.repo ? `${context.owner}/${context.repo}` : "generic";
    return `${repoSlug}@${context.sha}`;
  }

  async getDeploymentStatus(deploymentId: string, _context?: DeploymentContext): Promise<DeploymentStatus> {
    const recorded = this.statuses.get(deploymentId);
    if (recorded) return recorded;

    return {
      phase: "succeeded",
      activeVersion: deploymentId.split("@")[1] || "unknown",
      message: "Deployment active via Generic HTTP pipeline",
    };
  }

  async notifyStatus(deploymentId: string, status: DeploymentStatus): Promise<void> {
    this.statuses.set(deploymentId, status);

    if (this.webhookUrl) {
      try {
        await this.fetchFn(this.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deploymentId, status, timestamp: new Date().toISOString() }),
        });
      } catch {
        // Non-fatal notification failure
      }
    }
  }

  async abort(deploymentId: string, context?: DeploymentContext): Promise<void> {
    const status: DeploymentStatus = {
      phase: "aborted",
      message: "Deployment aborted by CARF policy gate",
    };
    if (context?.sha) {
      status.targetVersion = context.sha;
    }
    await this.notifyStatus(deploymentId, status);
  }

  async rollback(deploymentId: string, context?: DeploymentContext): Promise<void> {
    const status: DeploymentStatus = {
      phase: "failed",
      message: "Deployment rolled back by CARF policy authority",
    };
    if (context?.baseSha) {
      status.activeVersion = context.baseSha;
    }
    await this.notifyStatus(deploymentId, status);
  }
}
