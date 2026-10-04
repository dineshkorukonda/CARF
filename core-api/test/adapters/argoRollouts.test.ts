import { describe, expect, it, vi } from "vitest";
import { ArgoRolloutsIntegration } from "../../src/adapters/argoRollouts.js";

describe("ArgoRolloutsIntegration (Argo Rollouts Deployment Integration)", () => {
  it("identifies rollout target name", async () => {
    const integration = new ArgoRolloutsIntegration({ defaultRollout: "sample-argo-rollout" });
    const id = await integration.identifyDeployment({ sha: "commit-123", target: "my-custom-rollout" });
    expect(id).toBe("my-custom-rollout");
  });

  it("parses progressing rollout state and canary step weights", async () => {
    const rolloutJson = {
      metadata: { name: "sample-argo-rollout", namespace: "carf-test" },
      status: {
        phase: "Paused",
        message: "Canary paused at step 1 (weight 20%)",
        canary: { weights: { canary: { weight: 20 } } },
      },
    };

    const mockExec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify(rolloutJson),
      stderr: "",
    });

    const integration = new ArgoRolloutsIntegration({ exec: mockExec });
    const status = await integration.getDeploymentStatus("sample-argo-rollout");

    expect(status.phase).toBe("paused");
    expect(status.currentWeight).toBe(20);
    expect(status.message).toContain("20%");
  });

  it("executes abort command on threshold breach", async () => {
    const executedCommands: string[] = [];
    const mockExec = vi.fn().mockImplementation(async (cmd: string) => {
      executedCommands.push(cmd);
      return { stdout: "", stderr: "" };
    });

    const integration = new ArgoRolloutsIntegration({ namespace: "carf-test", exec: mockExec });
    await integration.abort("sample-argo-rollout");

    expect(executedCommands).toContain("kubectl argo rollouts abort sample-argo-rollout -n carf-test");
  });

  it("executes rollback via abort and undo", async () => {
    const executedCommands: string[] = [];
    const mockExec = vi.fn().mockImplementation(async (cmd: string) => {
      executedCommands.push(cmd);
      return { stdout: "", stderr: "" };
    });

    const integration = new ArgoRolloutsIntegration({ namespace: "carf-test", exec: mockExec });
    await integration.rollback("sample-argo-rollout");

    expect(executedCommands).toContain("kubectl argo rollouts abort sample-argo-rollout -n carf-test");
    expect(executedCommands).toContain("kubectl argo rollouts undo sample-argo-rollout -n carf-test");
  });
});
