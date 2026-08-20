import { describe, expect, it, vi } from "vitest";
import { acquireDiff, fetchBlobContent, getChangedFiles } from "../../../src/adapters/github/diffAcquisition.js";
import type { GitHubApiClient } from "../../../src/adapters/github/githubApiClient.js";

function mockClient(overrides: Partial<GitHubApiClient> = {}): GitHubApiClient {
  return {
    compareCommits: vi.fn(),
    getContent: vi.fn(),
    ...overrides,
  };
}

describe("getChangedFiles", () => {
  it("parses the compare API response into changed-file paths + status", async () => {
    const client = mockClient({
      compareCommits: vi.fn().mockResolvedValue({
        files: [
          { filename: "src/a.ts", status: "modified" },
          { filename: "src/new.ts", status: "added" },
          { filename: "src/old.ts", status: "removed" },
          { filename: "src/renamed-to.ts", status: "renamed" },
        ],
      }),
    });

    const result = await getChangedFiles(client, "owner", "repo", "base-sha", "head-sha", "token");

    expect(result).toEqual([
      { path: "src/a.ts", status: "modified" },
      { path: "src/new.ts", status: "added" },
      { path: "src/old.ts", status: "removed" },
      { path: "src/renamed-to.ts", status: "renamed" },
    ]);
    expect(client.compareCommits).toHaveBeenCalledWith("owner", "repo", "base-sha", "head-sha", "token");
  });
});

describe("fetchBlobContent", () => {
  it("returns file content when the blob exists", async () => {
    const client = mockClient({
      getContent: vi.fn().mockResolvedValue("const a = 1;"),
    });

    const content = await fetchBlobContent(client, "owner", "repo", "src/a.ts", "some-sha", "token");
    expect(content).toBe("const a = 1;");
  });

  it("returns null for a file that doesn't exist on that ref (e.g. added/removed side)", async () => {
    const client = mockClient({
      getContent: vi.fn().mockRejectedValue({ status: 404 }),
    });

    const content = await fetchBlobContent(client, "owner", "repo", "src/new.ts", "base-sha", "token");
    expect(content).toBeNull();
  });

  it("does not swallow non-404 errors", async () => {
    const client = mockClient({
      getContent: vi.fn().mockRejectedValue({ status: 500, message: "boom" }),
    });

    await expect(fetchBlobContent(client, "owner", "repo", "src/a.ts", "sha", "token")).rejects.toMatchObject({
      status: 500,
    });
  });
});

describe("acquireDiff", () => {
  it("orchestrates changed-file listing + before/after blob fetches into classifyCommit()'s input shape", async () => {
    const client = mockClient({
      compareCommits: vi.fn().mockResolvedValue({
        files: [
          { filename: "src/a.ts", status: "modified" },
          { filename: "src/new.ts", status: "added" },
          { filename: "src/old.ts", status: "removed" },
        ],
      }),
      getContent: vi.fn().mockImplementation((_o, _r, path: string, ref: string) => {
        if (path === "src/new.ts" && ref === "base-sha") return Promise.reject({ status: 404 });
        if (path === "src/old.ts" && ref === "head-sha") return Promise.reject({ status: 404 });
        return Promise.resolve(`content:${path}@${ref}`);
      }),
    });

    const result = await acquireDiff(client, "owner", "repo", "base-sha", "head-sha", "token");

    expect(result).toEqual(
      expect.arrayContaining([
        { path: "src/a.ts", before: "content:src/a.ts@base-sha", after: "content:src/a.ts@head-sha" },
        { path: "src/new.ts", before: "", after: "content:src/new.ts@head-sha" },
        { path: "src/old.ts", before: "content:src/old.ts@base-sha", after: "" },
      ])
    );
    expect(result).toHaveLength(3);
  });

  it("surfaces a typed error for a failed blob fetch instead of silently dropping the file", async () => {
    const client = mockClient({
      compareCommits: vi.fn().mockResolvedValue({
        files: [{ filename: "src/a.ts", status: "modified" }],
      }),
      getContent: vi.fn().mockRejectedValue({ status: 500, message: "rate limited" }),
    });

    await expect(acquireDiff(client, "owner", "repo", "base-sha", "head-sha", "token")).rejects.toMatchObject({
      status: 500,
    });
  });
});
