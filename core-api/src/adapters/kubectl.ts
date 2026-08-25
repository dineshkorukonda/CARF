import { defaultExec, type ExecFn } from "./execFn.js";
import type { RollbackAdapter } from "./rollbackAdapter.js";

export interface KubectlAdapterOptions {
  /** Injected exec function, defaulting to Node's real `child_process.exec`, promisified. */
  exec?: ExecFn;
  /** Optional `-n <namespace>` flag, applied to every invocation. */
  namespace?: string;
}

interface DeploymentStatus {
  spec?: { replicas?: number };
  status?: { readyReplicas?: number; unavailableReplicas?: number };
}

/**
 * `RollbackAdapter` backed by `kubectl`, targeting a Deployment by name.
 *
 * Health convention: `kubectl get deployment <target> -o json` is inspected for
 * `spec.replicas` (desired) and `status.unavailableReplicas`. `errorRate` is
 * `unavailableReplicas / desiredReplicas` (0 when there are zero desired replicas,
 * treated as healthy rather than dividing by zero).
 *
 * Rollback: `kubectl rollout undo deployment/<target>`, which reverts to the
 * previous ReplicaSet/revision — kubectl's own rollback mechanism, so no explicit
 * previous-tag bookkeeping is needed on our side.
 */
export class KubectlAdapter implements RollbackAdapter {
  private readonly exec: ExecFn;
  private readonly namespaceFlag: string;

  constructor(options: KubectlAdapterOptions = {}) {
    this.exec = options.exec ?? defaultExec;
    this.namespaceFlag = options.namespace ? ` -n ${options.namespace}` : "";
  }

  async checkHealth(target: string): Promise<{ errorRate: number; healthy: boolean }> {
    const { stdout } = await this.exec(`kubectl get deployment ${target}${this.namespaceFlag} -o json`);
    const deployment: DeploymentStatus = JSON.parse(stdout);

    const desired = deployment.spec?.replicas ?? 0;
    const unavailable = deployment.status?.unavailableReplicas ?? 0;
    const errorRate = desired > 0 ? unavailable / desired : 0;

    return { errorRate, healthy: errorRate === 0 };
  }

  async rollback(target: string): Promise<void> {
    await this.exec(`kubectl rollout undo deployment/${target}${this.namespaceFlag}`);
  }
}
