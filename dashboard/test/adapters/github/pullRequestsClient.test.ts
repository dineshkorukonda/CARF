import { describe, expect, it, vi } from "vitest";
import { listRepositoryPullRequests } from "../../../src/adapters/github/pullRequestsClient";

describe("listRepositoryPullRequests", () => {
  it("loads open and historical PR metadata using installation auth", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ number: 42, title: "Fix health checks", state: "closed", draft: false, merged_at: "2026-10-08", user: { login: "dev" }, head: { sha: "head", ref: "fix" }, base: { ref: "main" }, updated_at: "2026-10-08" }] });
    const result = await listRepositoryPullRequests("acme", "my repo", "installation-token", fetch);
    expect(fetch).toHaveBeenCalledWith("https://api.github.com/repos/acme/my%20repo/pulls?state=all&sort=updated&direction=desc&per_page=50", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer installation-token" }) }));
    expect(result).toEqual({ limited: false, pullRequests: [{ number: 42, title: "Fix health checks", state: "closed", draft: false, mergedAt: "2026-10-08", author: "dev", headSha: "head", headRef: "fix", baseRef: "main", updatedAt: "2026-10-08" }] });
  });
  it("reports GitHub permission failures rather than an empty history", async () => {
    await expect(listRepositoryPullRequests("acme", "app", "token", vi.fn().mockResolvedValue({ ok: false, status: 403 }))).rejects.toThrow("Pull requests: Read");
  });
});
