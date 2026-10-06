import { assertSafeTarget, type CommandExecutor, defaultExec, type ExecFn, LocalCommandExecutor } from "./execFn.js";
import type { DeploymentContext, DeploymentIntegration, DeploymentStatus } from "./contracts.js";

export interface FlaggerIntegrationOptions {
  namespace?: string | undefined;
  defaultCanary?: string | undefined;
  exec?: CommandExecutor | ExecFn | undefined;
}

export interface FlaggerCanaryJson {
  metadata?: {
    name?: string | undefined;
    namespace?: string | undefined;
  } | undefined;
  status?: {
    phase?: string | undefined;
    canaryWeight?: number | undefined;
    failedChecks?: number | undefined;
    iterations?: number | undefined;
    conditions?: Array<{
      type?: string | undefined;
      status?: string | undefined;
      message?: string | undefined;
    }> | undefined;
  } | undefined;
}

/**
 * Flagger Deployment Integration.
 * Integrates with Flagger progressive delivery operator on Kubernetes to:
 * - Monitor Canary custom resource status and traffic weight progression
 * - Track metric analysis failure thresholds
 * - Trigger or verify automatic canary rollback to primary stable workload
 */
export class FlaggerIntegration implements DeploymentIntegration {
  readonly kind = "flagger";
  private readonly executor: CommandExecutor;
  private readonly namespace: string;
  private readonly defaultCanary: string;

  constructor(options: FlaggerIntegrationOptions = {}) {
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
    this.defaultCanary = options.defaultCanary ?? "sample-app-canary";
    assertSafeTarget(this.namespace, "namespace");
    assertSafeTarget(this.defaultCanary, "defaultCanary");
  }

  async identifyDeployment(context: DeploymentContext): Promise<string> {
    const name = context.target || this.defaultCanary;
    assertSafeTarget(name, "canaryName");
    return name;
  }

  async getDeploymentStatus(deploymentId: string, _context?: DeploymentContext): Promise<DeploymentStatus> {
    assertSafeTarget(deploymentId, "deploymentId");

    try {
      const res = await this.executor.exec(
        `kubectl get canary ${deploymentId} -n ${this.namespace} -o json`
      );
      const parsed = JSON.parse(res.stdout) as FlaggerCanaryJson;
      const rawPhase = parsed.status?.phase ?? "Unknown";

      let phase: DeploymentStatus["phase"] = "progressing";
      if (rawPhase === "Succeeded" || rawPhase === "Initialized") {
        phase = "healthy";
      } else if (rawPhase === "Waiting") {
        phase = "paused";
      } else if (rawPhase === "Failed") {
        phase = "failed";
      }

      const weight = parsed.status?.canaryWeight;
      const conditionMsg = parsed.status?.conditions?.[0]?.message;

      const status: DeploymentStatus = {
        phase,
        message: conditionMsg ?? `Flagger Canary is ${rawPhase}`,
      };
      if (typeof weight === "number") {
        status.currentWeight = weight;
      }

      return status;
    } catch {
      return {
        phase: "pending",
        message: "Flagger Canary status query pending",
      };
    }
  }

  async abort(deploymentId: string, _context?: DeploymentContext): Promise<void> {
    assertSafeTarget(deploymentId, "deploymentId");
    // In Flagger, pausing or scaling the canary deployment aborts traffic progression
    try {
      await this.executor.exec(
        `kubectl annotate canary ${deploymentId} -n ${this.namespace} flagger.app/status="halted" --overwrite`
      );
    } catch {
      // Annotate fallback
    }
  }

  async rollback(deploymentId: string, context?: DeploymentContext): Promise<void> {
    assertSafeTarget(deploymentId, "deploymentId");
    await this.abort(deploymentId, context);

    if (context?.baseSha) {
      assertSafeTarget(context.baseSha, "baseSha");
      try {
        await this.executor.exec(
          `kubectl set image deployment/${deploymentId} app=carf-sample-app:${context.baseSha} -n ${this.namespace}`
        );
      } catch {
        // Fallback
      }
    }
  }
}
