import { describe, expect, it, vi } from "vitest";
import { getRepositoryPullRequest, listPullRequestFiles, listRepositoryPullRequests } from "../../../src/adapters/github/pullRequestsClient";

describe("listRepositoryPullRequests", () => {
  it("paginates PR files and retains renames without exposing patch contents", async () => {
    const file = { filename: "new.ts", previous_filename: "old.ts", status: "renamed", additions: 2, deletions: 1, patch: "private contents" };
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => Array(100).fill(file) }).mockResolvedValueOnce({ ok: true, json: async () => [file] });
    const files = await listPullRequestFiles("acme", "app", 217, "token", fetch);
    expect(files).toHaveLength(101); expect(files[100]).toEqual({ filename: "new.ts", previous_filename: "old.ts", status: "renamed", additions: 2, deletions: 1 });
    expect(fetch.mock.calls[1]![0]).toContain("/pulls/217/files?per_page=100&page=2");
  });
  it("bounds file pagination to GitHub's limit", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => Array(100).fill({ filename: "a", status: "added", additions: 1, deletions: 0 }) });
    expect(await listPullRequestFiles("acme", "app", 7, "token", fetch)).toHaveLength(3000); expect(fetch).toHaveBeenCalledTimes(30);
  });
  it("fails a partial diff rather than silently returning missing files", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => Array(100).fill({}) }).mockResolvedValueOnce({ ok: false });
    await expect(listPullRequestFiles("acme", "app", 7, "token", fetch)).rejects.toThrow("files");
  });
  it("fetches a PR directly by number with its base and head", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ number: 7, title: "Fix", state: "open", merged_at: null, user: null, head: { sha: "head", ref: "fix" }, base: { sha: "base", ref: "main" }, updated_at: "today" }) });
    expect(await getRepositoryPullRequest("acme", "my repo", 7, "token", fetch)).toMatchObject({ number: 7, baseSha: "base", headSha: "head", author: "Unknown" });
    expect(fetch).toHaveBeenCalledWith("https://api.github.com/repos/acme/my%20repo/pulls/7", expect.objectContaining({ cache: "no-store", headers: expect.objectContaining({ Authorization: "Bearer token" }) }));
  });
  it("reports inaccessible detail reads", async () => {
    await expect(getRepositoryPullRequest("acme", "app", 7, "token", vi.fn().mockResolvedValue({ ok: false, status: 404 }))).rejects.toThrow("not found");
  });
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
