import { describe, expect, it, vi } from "vitest";
import { getCommitMetadata, listCompareFiles } from "../../../src/adapters/github/compareClient";
import type { FetchFn } from "../../../src/adapters/github/fetchTypes";

describe("listCompareFiles", () => {
  it("returns GitHub compare files", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        files: [{ filename: "src/a.ts", status: "modified", additions: 3, deletions: 1 }],
      }),
      text: async () => "",
    });
    const files = await listCompareFiles("o", "r", "aaa", "bbb", "tok", fetchFn);
    expect(files).toEqual([{ filename: "src/a.ts", status: "modified", additions: 3, deletions: 1 }]);
  });

  it("throws when GitHub rejects the compare", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
      text: async () => "",
    });
    await expect(listCompareFiles("o", "r", "aaa", "bbb", "tok", fetchFn)).rejects.toThrow(/status 404/);
  });
});

describe("getCommitMetadata", () => {
  it("shows the commit subject and GitHub author on the detail page", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ commit: { message: "fix: useful subject\n\nBody", author: { name: "Local Name" } }, author: { login: "github-user" } }),
    });
    await expect(getCommitMetadata("acme", "api", "abc123", "token", fetchFn)).resolves.toEqual({
      message: "fix: useful subject",
      author: "github-user",
    });
    expect(fetchFn).toHaveBeenCalledWith(expect.stringContaining("/repos/acme/api/commits/abc123"), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token" }) }));
  });
});
