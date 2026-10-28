import { assertSafeTarget, type CommandExecutor, defaultExec, type ExecFn, LocalCommandExecutor } from "./execFn.js";
import type { DeploymentContext, DeploymentIntegration, DeploymentStatus } from "./contracts.js";

export interface ArgoRolloutsIntegrationOptions {
  namespace?: string | undefined;
  defaultRollout?: string | undefined;
  exec?: CommandExecutor | ExecFn | undefined;
}

export interface ArgoRolloutJson {
  metadata?: {
    name?: string | undefined;
    namespace?: string | undefined;
  } | undefined;
  spec?: {
    strategy?: {
      canary?: {
        steps?: Array<{ setWeight?: number | undefined; pause?: { duration?: string | undefined } | undefined }> | undefined;
      } | undefined;
    } | undefined;
  } | undefined;
  status?: {
    phase?: string | undefined;
    message?: string | undefined;
    currentStepIndex?: number | undefined;
    canary?: {
      weights?: {
        canary?: {
          weight?: number | undefined;
        } | undefined;
      } | undefined;
    } | undefined;
    availableReplicas?: number | undefined;
    updatedReplicas?: number | undefined;
  } | undefined;
}

/**
 * Argo Rollouts Deployment Integration.
 * Integrates with Argo Rollouts controller on Kubernetes to:
 * - Identify and observe canary rollout lifecycle
 * - Track progression through canary steps and traffic weights
 * - Trigger native `kubectl argo rollouts abort` on policy or threshold breach
 * - Revert rollout to previous revision via `kubectl argo rollouts undo`
 */
export class ArgoRolloutsIntegration implements DeploymentIntegration {
  readonly kind = "argo_rollouts";
  private readonly executor: CommandExecutor;
  private readonly namespace: string;
  private readonly defaultRollout: string;

  constructor(options: ArgoRolloutsIntegrationOptions = {}) {
    if (options.exec) {
      if (typeof options.exec === "function") {
        this.executor = new LocalCommandExecutor(options.exec);
      } else {
        this.executor = options.exec;
      }
    } else {
      this.executor = new LocalCommandExecutor(defaultExec);
    }

    this.namespace = options.namespace ?? "carf-test";
    this.defaultRollout = options.defaultRollout ?? "sample-argo-rollout";
    assertSafeTarget(this.namespace, "namespace");
    assertSafeTarget(this.defaultRollout, "defaultRollout");
  }

  async identifyDeployment(context: DeploymentContext): Promise<string> {
    const name = context.target || this.defaultRollout;
    assertSafeTarget(name, "rolloutName");
    return name;
  }

  async getDeploymentStatus(deploymentId: string, _context?: DeploymentContext): Promise<DeploymentStatus> {
    assertSafeTarget(deploymentId, "deploymentId");

    try {
      const res = await this.executor.exec(
        `kubectl get rollout ${deploymentId} -n ${this.namespace} -o json`
      );
      const parsed = JSON.parse(res.stdout) as ArgoRolloutJson;
      const rawPhase = parsed.status?.phase ?? "Unknown";

      let phase: DeploymentStatus["phase"] = "progressing";
      if (rawPhase === "Healthy") {
        phase = "healthy";
      } else if (rawPhase === "Paused") {
        phase = "paused";
      } else if (rawPhase === "Degraded") {
        phase = "failed";
      } else if (rawPhase === "Aborted") {
        phase = "aborted";
      }

      const weight = parsed.status?.canary?.weights?.canary?.weight;
      const status: DeploymentStatus = {
        phase,
        message: parsed.status?.message ?? `Argo Rollout is ${rawPhase}`,
      };
      if (typeof weight === "number") {
        status.currentWeight = weight;
      }

      return status;
    } catch {
      return {
        phase: "pending",
        message: "Argo Rollout status query pending",
      };
    }
  }

  async abort(deploymentId: string, _context?: DeploymentContext): Promise<void> {
    assertSafeTarget(deploymentId, "deploymentId");
    try {
      await this.executor.exec(`kubectl argo rollouts abort ${deploymentId} -n ${this.namespace}`);
    } catch {
      // Fallback via merge patch if CLI plugin is absent
      await this.executor.exec(
        `kubectl patch rollout ${deploymentId} -n ${this.namespace} --type=merge -p "{\\"spec\\":{\\"paused\\":true}}"`
      );
    }
  }

  async rollback(deploymentId: string, context?: DeploymentContext): Promise<void> {
    assertSafeTarget(deploymentId, "deploymentId");
    await this.abort(deploymentId, context);

    await this.executor.exec(`kubectl argo rollouts undo ${deploymentId} -n ${this.namespace}`);
  }
}
