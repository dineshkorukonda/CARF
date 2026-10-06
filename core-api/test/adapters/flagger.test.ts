import { describe, expect, it, vi } from "vitest";
import { FlaggerIntegration } from "../../src/adapters/flagger.js";

describe("FlaggerIntegration (Flagger Deployment Integration)", () => {
  it("identifies canary target name", async () => {
    const integration = new FlaggerIntegration({ defaultCanary: "sample-app-canary" });
    const id = await integration.identifyDeployment({ sha: "sha-v2", target: "checkout-canary" });
    expect(id).toBe("checkout-canary");
  });

  it("parses canary progression weight and conditions", async () => {
    const canaryJson = {
      metadata: { name: "sample-app-canary", namespace: "carf-test" },
      status: {
        phase: "Progressing",
        canaryWeight: 20,
        iterations: 2,
        conditions: [{ type: "Promoted", status: "False", message: "Canary advancement weight 20%" }],
      },
    };

    const mockExec = vi.fn().mockResolvedValue({
      stdout: JSON.stringify(canaryJson),
      stderr: "",
    });

    const integration = new FlaggerIntegration({ exec: mockExec });
    const status = await integration.getDeploymentStatus("sample-app-canary");

    expect(status.phase).toBe("progressing");
    expect(status.currentWeight).toBe(20);
    expect(status.message).toContain("20%");
  });

  it("triggers abort and canary rollback", async () => {
    const executedCommands: string[] = [];
    const mockExec = vi.fn().mockImplementation(async (cmd: string) => {
      executedCommands.push(cmd);
      return { stdout: "", stderr: "" };
    });

    const integration = new FlaggerIntegration({ namespace: "carf-test", exec: mockExec });
    await integration.rollback("sample-app-canary", {
      sha: "sha-v2-broken",
      baseSha: "sha-v1",
    });

    expect(executedCommands).toContain(
      "kubectl annotate canary sample-app-canary -n carf-test flagger.app/status=\"halted\" --overwrite"
    );
    expect(executedCommands).toContain(
      "kubectl set image deployment/sample-app-canary app=carf-sample-app:sha-v1 -n carf-test"
    );
  });
});
