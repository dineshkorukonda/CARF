import { describe, expect, it, vi } from "vitest";
import { KubectlAdapter } from "../../src/adapters/kubectl.js";

function deploymentJson(overrides: { replicas?: number; readyReplicas?: number; unavailableReplicas?: number }) {
  return JSON.stringify({
    spec: { replicas: overrides.replicas ?? 3 },
    status: {
      readyReplicas: overrides.readyReplicas ?? 3,
      unavailableReplicas: overrides.unavailableReplicas ?? 0,
    },
  });
}

function mockExec(stdout: string, stderr = "") {
  return vi.fn().mockResolvedValue({ stdout, stderr });
}

describe("KubectlAdapter.checkHealth", () => {
  it("reports healthy with errorRate 0 when all replicas are ready", async () => {
    const exec = mockExec(deploymentJson({ replicas: 3, readyReplicas: 3, unavailableReplicas: 0 }));
    const adapter = new KubectlAdapter({ exec });

    const result = await adapter.checkHealth("my-app");

    expect(exec).toHaveBeenCalledWith("kubectl get deployment my-app -o json");
    expect(result).toEqual({ errorRate: 0, healthy: true });
  });

  it("computes a fractional errorRate from unavailableReplicas / desired replicas", async () => {
    const exec = mockExec(deploymentJson({ replicas: 4, readyReplicas: 3, unavailableReplicas: 1 }));
    const adapter = new KubectlAdapter({ exec });

    const result = await adapter.checkHealth("my-app");

    expect(result.errorRate).toBe(0.25);
    expect(result.healthy).toBe(false);
  });

  it("includes the configured namespace flag when provided", async () => {
    const exec = mockExec(deploymentJson({}));
    const adapter = new KubectlAdapter({ exec, namespace: "prod" });

    await adapter.checkHealth("my-app");

    expect(exec).toHaveBeenCalledWith("kubectl get deployment my-app -n prod -o json");
  });

  it("treats zero desired replicas as healthy with errorRate 0", async () => {
    const exec = mockExec(deploymentJson({ replicas: 0, readyReplicas: 0, unavailableReplicas: 0 }));
    const adapter = new KubectlAdapter({ exec });

    const result = await adapter.checkHealth("my-app");

    expect(result).toEqual({ errorRate: 0, healthy: true });
  });
});

describe("KubectlAdapter.rollback", () => {
  it("rolls back via kubectl rollout undo", async () => {
    const exec = mockExec("");
    const adapter = new KubectlAdapter({ exec });

    await adapter.rollback("my-app");

    expect(exec).toHaveBeenCalledWith("kubectl rollout undo deployment/my-app");
  });

  it("includes the configured namespace flag on rollback too", async () => {
    const exec = mockExec("");
    const adapter = new KubectlAdapter({ exec, namespace: "prod" });

    await adapter.rollback("my-app");

    expect(exec).toHaveBeenCalledWith("kubectl rollout undo deployment/my-app -n prod");
  });
});
