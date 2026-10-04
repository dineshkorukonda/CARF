import { describe, expect, it } from "vitest";
import { GitHubActionsIntegration } from "../../src/adapters/githubActions.js";

describe("GitHubActionsIntegration", () => {
  it("identifies deployment from runId or commit sha", async () => {
    const integration = new GitHubActionsIntegration();
    const id = await integration.identifyDeployment({
      owner: "octocat",
      repo: "hello-world",
      sha: "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d",
      metadata: { runId: 123456789 },
    });
    expect(id).toBe("octocat/hello-world#123456789");
  });

  it("updates and retrieves status", async () => {
    const integration = new GitHubActionsIntegration();
    await integration.abort("octocat/hello-world#123", { sha: "fail-sha" });
    const status = await integration.getDeploymentStatus("octocat/hello-world#123");
    expect(status.phase).toBe("aborted");
    expect(status.targetVersion).toBe("fail-sha");

    await integration.rollback("octocat/hello-world#123", { sha: "fail-sha", baseSha: "prev-sha" });
    const rollbackStatus = await integration.getDeploymentStatus("octocat/hello-world#123");
    expect(rollbackStatus.phase).toBe("failed");
    expect(rollbackStatus.activeVersion).toBe("prev-sha");
  });
});
