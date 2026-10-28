import type { RollbackAdapter } from "./rollbackAdapter.js";

export type { RollbackAdapter };

/**
 * Health telemetry probe output from a runtime adapter.
 */
export interface RuntimeHealthResult {
  errorRate: number;
  healthy: boolean;
  processErrorRate?: number;
  httpErrorRate?: number;
  perTarget?: Record<string, unknown>;
}

/**
 * Inspected state of a runtime workload/target.
 */
export interface RuntimeStatus {
  target?: string;
  version?: string | null;
  status?: "online" | "healthy" | "degraded" | "unhealthy" | "stopped" | "unknown" | string;
  uptimeSeconds?: number;
  instances?: number;
  connected?: boolean;
  processes?: unknown[];
  metadata?: Record<string, unknown>;
}

/**
 * Standard contract for Runtime Adapters (PM2, Docker, Kubernetes, None).
 * Responsible for process discovery, health monitoring, restart/reload, and rollback.
 */
export interface RuntimeAdapter extends RollbackAdapter {
  readonly kind?: string;
  isAvailable?(): Promise<boolean>;
  discover?(): Promise<string[] | { connected: boolean; processes: unknown[] }>;
  getStatus?(target?: string): Promise<RuntimeStatus | { runtime: string; connected: boolean; processes: unknown[] }>;
  checkHealth(target?: string): Promise<RuntimeHealthResult>;
  rollback(target?: string): Promise<void>;
  rollbackWithVerification?(
    target?: string,
    graceSeconds?: number
  ): Promise<{ rollbackVerified: boolean; verified?: boolean; errorRate?: number }>;
  applyRelease?(sha: string, target?: string): Promise<void>;
  restart?(target?: string): Promise<void>;
  reload?(target?: string): Promise<void>;
}

/**
 * Context identifying a deployment execution in a CI/CD pipeline or orchestrator.
 */
export interface DeploymentContext {
  owner?: string;
  repo?: string;
  sha: string;
  baseSha?: string;
  target?: string;
  environment?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Live status of a deployment progression.
 */
export interface DeploymentStatus {
  phase: "pending" | "progressing" | "paused" | "healthy" | "aborted" | "failed" | "succeeded";
  currentWeight?: number;
  message?: string;
  activeVersion?: string;
  targetVersion?: string;
}

/**
 * Standard contract for Deployment Integrations (GitHub Actions, Generic HTTP, Argo Rollouts).
 * Responsible for deployment intake, tracking lifecycle progression, and triggering aborts/rollbacks.
 */
export interface DeploymentIntegration {
  readonly kind: string;
  identifyDeployment(context: DeploymentContext): Promise<string>;
  getDeploymentStatus(deploymentId: string, context?: DeploymentContext): Promise<DeploymentStatus>;
  notifyStatus?(deploymentId: string, status: DeploymentStatus): Promise<void>;
  abort?(deploymentId: string, context?: DeploymentContext): Promise<void>;
  rollback?(deploymentId: string, context?: DeploymentContext): Promise<void>;
}
