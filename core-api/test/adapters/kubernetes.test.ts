import { describe, expect, it, vi } from "vitest";
import { KubernetesAdapter } from "../../src/adapters/kubernetes.js";

describe("KubernetesAdapter (Kubernetes Runtime Adapter)", () => {
  it("detects availability when kubectl client is present", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      stdout: "Client Version: v1.36.3\nKustomize Version: v5.0.4\n",
      stderr: "",
    });
    const adapter = new KubernetesAdapter("1", { exec: mockExec });
    expect(await adapter.isAvailable()).toBe(true);
  });

  it("discovers deployments within configured namespace", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      stdout: "sample-k8s-app redis-deployment api-gateway\n",
      stderr: "",
    });
    const adapter = new KubernetesAdapter("1", { namespace: "carf-test", exec: mockExec });
    const deployments = await adapter.discover();
    expect(deployments).toEqual(["sample-k8s-app", "redis-deployment", "api-gateway"]);
  });

  it("inspects deployment replicas and active image", async () => {
    const deploymentJson = {
      metadata: { name: "sample-k8s-app", namespace: "carf-test" },
      spec: {
        replicas: 2,
        template: { spec: { containers: [{ name: "sample-k8s-app", image: "carf-sample-app:v2" }] } },
      },
      status: { replicas: 2, availableReplicas: 2, updatedReplicas: 2 },
    };

    const mockExec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify(deploymentJson),
      stderr: "",
    });

    const adapter = new KubernetesAdapter("1", { namespace: "carf-test", exec: mockExec });
    const status = await adapter.getStatus("sample-k8s-app");

    expect(status.status).toBe("online");
    expect(status.version).toBe("carf-sample-app:v2");
    expect(status.instances).toBe(2);
  });

  it("reports healthy when desired replicas match available replicas and HTTP probes pass", async () => {
    const deploymentJson = {
      spec: { replicas: 2 },
      status: { replicas: 2, availableReplicas: 2, unavailableReplicas: 0 },
    };
    const mockExec = vi.fn().mockResolvedValue({ stdout: JSON.stringify(deploymentJson), stderr: "" });
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const adapter = new KubernetesAdapter("1", {
      namespace: "carf-test",
      healthUrl: "http://localhost:8080/health",
      exec: mockExec,
      fetchFn: mockFetch,
    });

    const health = await adapter.checkHealth("sample-k8s-app");
    expect(health.healthy).toBe(true);
    expect(health.errorRate).toBe(0);
  });

  it("detects failure when unavailable replicas exist", async () => {
    const deploymentJson = {
      spec: { replicas: 2 },
      status: { replicas: 2, availableReplicas: 1, unavailableReplicas: 1 },
    };
    const mockExec = vi.fn().mockResolvedValue({ stdout: JSON.stringify(deploymentJson), stderr: "" });

    const adapter = new KubernetesAdapter("1", { namespace: "carf-test", exec: mockExec });
    const health = await adapter.checkHealth("sample-k8s-app");

    expect(health.healthy).toBe(false);
    expect(health.errorRate).toBe(0.5);
  });

  it("applies new release via kubectl set image", async () => {
    const executedCommands: string[] = [];
    const mockExec = vi.fn().mockImplementation(async (cmd: string) => {
      executedCommands.push(cmd);
      return { stdout: "", stderr: "" };
    });

    const adapter = new KubernetesAdapter("1", {
      namespace: "carf-test",
      deploymentName: "sample-k8s-app",
      containerName: "app",
      exec: mockExec,
    });

    await adapter.applyRelease("carf-sample-app:v2");
    expect(executedCommands).toContain(
      "kubectl set image deployment/sample-k8s-app app=carf-sample-app:v2 -n carf-test"
    );
  });

  it("triggers native kubectl rollout undo on rollback", async () => {
    const executedCommands: string[] = [];
    const mockExec = vi.fn().mockImplementation(async (cmd: string) => {
      executedCommands.push(cmd);
      return { stdout: "", stderr: "" };
    });

    const adapter = new KubernetesAdapter("1", {
      namespace: "carf-test",
      deploymentName: "sample-k8s-app",
      exec: mockExec,
    });

    await adapter.rollback();
    expect(executedCommands).toContain(
      "kubectl rollout undo deployment/sample-k8s-app -n carf-test --to-revision=1"
    );
  });

  it("verifies post-rollback status via kubectl rollout status", async () => {
    const mockExec = vi.fn().mockImplementation(async (cmd: string) => {
      if (cmd.includes("rollout status")) {
        return { stdout: "deployment \"sample-k8s-app\" successfully rolled out\n", stderr: "" };
      }
      if (cmd.includes("get deployment")) {
        return {
          stdout: JSON.stringify({
            spec: { replicas: 1 },
            status: { replicas: 1, availableReplicas: 1, unavailableReplicas: 0 },
          }),
          stderr: "",
        };
      }
      return { stdout: "", stderr: "" };
    });

    const adapter = new KubernetesAdapter("1", {
      namespace: "carf-test",
      deploymentName: "sample-k8s-app",
      exec: mockExec,
    });

    const result = await adapter.rollbackWithVerification();
    expect(result.rollbackVerified).toBe(true);
    expect(result.errorRate).toBe(0);
  });
});
