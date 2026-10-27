import { describe, expect, it, vi } from "vitest";
import { verifyDeploymentCi } from "../../../src/adapters/github/verifyDeploymentCi.js";

const input = { owner: "acme", repo: "app", branch: "main", sha: "a".repeat(40), runId: 12, token: "token" };
const passed = { name: "CI", status: "completed", conclusion: "success", event: "push", head_sha: input.sha, head_branch: "main", repository: { full_name: "acme/app", default_branch: "main" }, head_repository: { full_name: "acme/app" } };
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body, text: async () => "" });

describe("deployment CI verification", () => {
  it("accepts successful push CI for the exact revision", async () => {
    const fetch = vi.fn(async (url: string) => response(url.includes("/actions/runs/") ? passed : { default_branch: "main" }));
    await expect(verifyDeploymentCi(input, fetch)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith("https://api.github.com/repos/acme/app/actions/runs/12", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token" }) }));
  });
  it.each([
    { conclusion: "failure" }, { status: "in_progress" }, { event: "pull_request" },
    { name: "CARF PM2 Deployment" }, { name: "Documentation check" }, { head_sha: "b".repeat(40) }, { head_branch: "feature" },
    { repository: { full_name: "other/app" } }, { head_repository: { full_name: "fork/app" } },
  ])("rejects mismatched or unpassed CI: %j", async (change) => {
    await expect(verifyDeploymentCi(input, async () => response({ ...passed, ...change }))).rejects.toThrow("requires a successful CI push run");
  });
  it("fails closed when GitHub cannot verify CI", async () => {
    await expect(verifyDeploymentCi(input, async () => response({}, 403))).rejects.toThrow("Actions: Read");
  });
  it("accepts only the configured custom workflow identity", async () => {
    const fetch = async (url: string) => response(url.includes("/actions/runs/")
      ? { ...passed, name: "Required tests" } : { default_branch: "main" });
    await expect(verifyDeploymentCi(input, fetch)).rejects.toThrow("requires a successful CI push run");
    await expect(verifyDeploymentCi({ ...input, ciWorkflowName: "Required tests" }, fetch)).resolves.toBeUndefined();
  });
  it("rejects successful CI on a non-default branch", async () => {
    await expect(verifyDeploymentCi(input, async (url) => response(url.includes("/actions/runs/") ? passed : { default_branch: "release" }))).rejects.toThrow("default branch");
  });
});
