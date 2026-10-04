import { describe, expect, it, vi } from "vitest";
import { GenericHttpIntegration } from "../../src/adapters/genericHttp.js";

describe("GenericHttpIntegration (Generic CI/CD Pipeline Integration)", () => {
  it("identifies deployment from context metadata or sha fallback", async () => {
    const integration = new GenericHttpIntegration();
    const id1 = await integration.identifyDeployment({
      owner: "acme",
      repo: "my-service",
      sha: "commit-abc-123",
      metadata: { deploymentId: "deploy-custom-99" },
    });
    expect(id1).toBe("deploy-custom-99");

    const id2 = await integration.identifyDeployment({
      owner: "acme",
      repo: "my-service",
      sha: "commit-abc-123",
    });
    expect(id2).toBe("acme/my-service@commit-abc-123");
  });

  it("notifies status and dispatches webhook when configured", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const integration = new GenericHttpIntegration({
      webhookUrl: "https://ci.example.com/webhook",
      fetchFn: mockFetch,
    });

    await integration.notifyStatus("deploy-1", { phase: "progressing", message: "Rolling out canary" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://ci.example.com/webhook",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );

    const status = await integration.getDeploymentStatus("deploy-1");
    expect(status.phase).toBe("progressing");
  });

  it("handles abort and rollback lifecycle notifications", async () => {
    const integration = new GenericHttpIntegration();
    await integration.abort("deploy-1", { sha: "bad-commit-1" });
    const abortedStatus = await integration.getDeploymentStatus("deploy-1");
    expect(abortedStatus.phase).toBe("aborted");
    expect(abortedStatus.targetVersion).toBe("bad-commit-1");

    await integration.rollback("deploy-1", { sha: "bad-commit-1", baseSha: "good-commit-0" });
    const rolledBackStatus = await integration.getDeploymentStatus("deploy-1");
    expect(rolledBackStatus.phase).toBe("failed");
    expect(rolledBackStatus.activeVersion).toBe("good-commit-0");
  });
});
