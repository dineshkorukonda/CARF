import { assertSafeTarget, type CommandExecutor, defaultExec, type ExecFn, LocalCommandExecutor } from "./execFn.js";
import type { RuntimeAdapter, RuntimeHealthResult, RuntimeStatus } from "./contracts.js";

export interface KubernetesAdapterOptions {
  namespace?: string | undefined;
  deploymentName?: string | undefined;
  containerName?: string | undefined;
  healthUrl?: string | undefined;
  probeCount?: number | undefined;
  startupGraceSeconds?: number | undefined;
  exec?: CommandExecutor | ExecFn | undefined;
  fetchFn?: ((url: string) => Promise<{ ok: boolean; status: number }>) | undefined;
  sleep?: ((ms: number) => Promise<void>) | undefined;
  now?: (() => number) | undefined;
}

export interface K8sDeploymentJson {
  metadata?: {
    name?: string | undefined;
    namespace?: string | undefined;
  } | undefined;
  spec?: {
    replicas?: number | undefined;
    template?: {
      spec?: {
        containers?: Array<{ name?: string | undefined; image?: string | undefined }> | undefined;
      } | undefined;
    } | undefined;
  } | undefined;
  status?: {
    replicas?: number | undefined;
    updatedReplicas?: number | undefined;
    readyReplicas?: number | undefined;
    availableReplicas?: number | undefined;
    unavailableReplicas?: number | undefined;
  } | undefined;
}

/**
 * Kubernetes Runtime Adapter.
 * Integrates directly with Kubernetes clusters via kubectl to:
 * - Discover Deployments in namespaces
 * - Inspect deployment replicas, available pod counts, and rollout phases
 * - Monitor pod readiness and HTTP health probes
 * - Execute native rolling releases and atomic `kubectl rollout undo` operations
 * - Verify post-rollback readiness via `kubectl rollout status`
 */
export class KubernetesAdapter implements RuntimeAdapter {
  readonly kind = "kubernetes";
  private readonly executor: CommandExecutor;
  private readonly namespace: string;
  private readonly defaultDeployment: string;
  private readonly containerName?: string | undefined;
  private readonly healthUrl?: string | undefined;
  private readonly probeCount: number;
  private readonly startupGraceSeconds: number;
  private readonly fetchFn: (url: string) => Promise<{ ok: boolean; status: number }>;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  constructor(
    private readonly previousRevision: string = "",
    options: KubernetesAdapterOptions = {}
  ) {
    if (previousRevision && previousRevision.trim().length > 0) {
      assertSafeTarget(previousRevision, "previousRevision");
    }

    if (options.exec) {
      if (typeof options.exec === "function") {
        this.executor = new LocalCommandExecutor(options.exec);
      } else {
        this.executor = options.exec;
      }
    } else {
      this.executor = new LocalCommandExecutor(defaultExec);
    }

    this.namespace = options.namespace ?? "default";
    this.defaultDeployment = options.deploymentName ?? "sample-k8s-app";
    assertSafeTarget(this.namespace, "namespace");
    assertSafeTarget(this.defaultDeployment, "deploymentName");

    if (options.containerName) {
      assertSafeTarget(options.containerName, "containerName");
      this.containerName = options.containerName;
    }

    this.healthUrl = options.healthUrl;
    this.probeCount = options.probeCount ?? 1;
    this.startupGraceSeconds = options.startupGraceSeconds ?? 60;
    this.fetchFn = options.fetchFn ?? ((url: string) => globalThis.fetch(url));
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now ?? Date.now;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.executor.exec("kubectl version --client");
      return res.stdout.toLowerCase().includes("client");
    } catch {
      return false;
    }
  }

  async discover(): Promise<string[]> {
    try {
      const res = await this.executor.exec(
        `kubectl get deployments -n ${this.namespace} -o jsonpath={.items[*].metadata.name}`
      );
      return res.stdout
        .split(/\s+/)
        .map((n) => n.trim())
        .filter((n) => n.length > 0);
    } catch {
      return [];
    }
  }

  async getStatus(target?: string): Promise<RuntimeStatus> {
    const deployment = target || this.defaultDeployment;
    assertSafeTarget(deployment, "deployment");

    try {
      const res = await this.executor.exec(
        `kubectl get deployment ${deployment} -n ${this.namespace} -o json`
      );
      const parsed = JSON.parse(res.stdout) as K8sDeploymentJson;
      const desired = parsed.spec?.replicas ?? 1;
      const available = parsed.status?.availableReplicas ?? 0;
      const primaryContainer = parsed.spec?.template?.spec?.containers?.[0];

      let status: RuntimeStatus["status"] = "online";
      if (available === 0 && desired > 0) {
        status = "unhealthy";
      } else if (available < desired) {
        status = "degraded";
      }

      return {
        target: deployment,
        version: primaryContainer?.image ?? null,
        status,
        instances: available,
        metadata: {
          desiredReplicas: desired,
          availableReplicas: available,
          updatedReplicas: parsed.status?.updatedReplicas ?? 0,
          namespace: this.namespace,
        },
      };
    } catch {
      return { target: deployment, status: "unknown" };
    }
  }

  async checkHealth(target?: string): Promise<RuntimeHealthResult> {
    const deployment = target || this.defaultDeployment;
    assertSafeTarget(deployment, "deployment");

    let k8sHealthy = true;
    let processErrorRate = 0;

    try {
      const res = await this.executor.exec(
        `kubectl get deployment ${deployment} -n ${this.namespace} -o json`
      );
      const parsed = JSON.parse(res.stdout) as K8sDeploymentJson;
      const desired = parsed.spec?.replicas ?? 1;
      const available = parsed.status?.availableReplicas ?? 0;
      const unavailable = parsed.status?.unavailableReplicas ?? 0;

      if (desired > 0 && available < desired) {
        k8sHealthy = false;
        processErrorRate = desired > 0 ? (desired - available) / desired : 1.0;
      } else if (unavailable > 0) {
        k8sHealthy = false;
        processErrorRate = desired > 0 ? unavailable / desired : 1.0;
      }
    } catch {
      k8sHealthy = false;
      processErrorRate = 1.0;
    }

    let httpHealthy = true;
    let httpErrorRate = 0;

    if (this.healthUrl && k8sHealthy) {
      let failedProbes = 0;
      for (let i = 0; i < this.probeCount; i++) {
        try {
          const resp = await this.fetchFn(this.healthUrl);
          if (!resp.ok || resp.status < 200 || resp.status >= 300) {
            failedProbes++;
          }
        } catch {
          failedProbes++;
        }
      }
      httpErrorRate = this.probeCount > 0 ? failedProbes / this.probeCount : 0;
      httpHealthy = httpErrorRate === 0;
    }

    const overallHealthy = k8sHealthy && httpHealthy;
    const errorRate = Math.max(processErrorRate, httpErrorRate);

    return {
      errorRate,
      healthy: overallHealthy,
      processErrorRate,
      httpErrorRate,
      perTarget: {
        [deployment]: { k8sHealthy, httpHealthy, errorRate },
      },
    };
  }

  async applyRelease(image: string, target?: string): Promise<void> {
    const deployment = target || this.defaultDeployment;
    assertSafeTarget(deployment, "deployment");
    assertSafeTarget(image, "image");

    const containerSpec = this.containerName ? `${this.containerName}=${image}` : `app=${image}`;
    await this.executor.exec(
      `kubectl set image deployment/${deployment} ${containerSpec} -n ${this.namespace}`
    );
  }

  async rollback(target?: string): Promise<void> {
    const deployment = target || this.defaultDeployment;
    assertSafeTarget(deployment, "deployment");

    const toRevisionArg = this.previousRevision ? ` --to-revision=${this.previousRevision}` : "";
    await this.executor.exec(
      `kubectl rollout undo deployment/${deployment} -n ${this.namespace}${toRevisionArg}`
    );
  }

  async rollbackWithVerification(
    target?: string,
    graceSeconds: number = this.startupGraceSeconds
  ): Promise<{ rollbackVerified: boolean; verified?: boolean; errorRate?: number }> {
    const deployment = target || this.defaultDeployment;
    await this.rollback(deployment);

    try {
      await this.executor.exec(
        `kubectl rollout status deployment/${deployment} -n ${this.namespace} --timeout=${graceSeconds}s`
      );
      const health = await this.checkHealth(deployment);
      return {
        rollbackVerified: false, // Health alone does not establish restoration identity.
        verified: false,
        errorRate: health.errorRate,
      };
    } catch {
      return { rollbackVerified: false, verified: false, errorRate: 1.0 };
    }
  }

  async restart(target?: string): Promise<void> {
    const deployment = target || this.defaultDeployment;
    assertSafeTarget(deployment, "deployment");
    await this.executor.exec(
      `kubectl rollout restart deployment/${deployment} -n ${this.namespace}`
    );
  }
}
