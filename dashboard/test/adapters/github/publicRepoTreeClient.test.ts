import { describe, expect, it, vi } from "vitest";
import { fetchPublicRepoTree, RepoNotFoundError } from "../../../src/adapters/github/publicRepoTreeClient";
import type { FetchFn } from "../../../src/adapters/github/fetchTypes";

describe("fetchPublicRepoTree", () => {
  it("returns blob paths from the recursive tree for a public repo", async () => {
    const fetchFn: FetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ private: false, default_branch: "main" }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          truncated: false,
          tree: [
            { path: "k8s/deployment.yaml", type: "blob" },
            { path: "src", type: "tree" },
            { path: "src/index.ts", type: "blob" },
          ],
        }),
      });

    const result = await fetchPublicRepoTree("acme", "widgets", fetchFn);

    expect(result).toMatchObject({ isPrivate: false, defaultBranch: "main", truncated: false });
    expect(result.paths).toEqual(["k8s/deployment.yaml", "src/index.ts"]);
  });

  it("returns isPrivate without fetching the tree for a private repo", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ private: true, default_branch: "main" }),
    });

    const result = await fetchPublicRepoTree("acme", "secret", fetchFn);

    expect(result).toEqual({ isPrivate: true, defaultBranch: "main", truncated: false, paths: [] });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("throws RepoNotFoundError on a 404", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    await expect(fetchPublicRepoTree("acme", "nope", fetchFn)).rejects.toThrow(RepoNotFoundError);
  });

  it("throws on a non-404 error status", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(fetchPublicRepoTree("acme", "widgets", fetchFn)).rejects.toThrow(/status 500/);
  });
});
