import { describe, expect, it, vi } from "vitest";
import { listInstallationRepos } from "../../../src/adapters/github/reposClient";
import type { FetchFn } from "../../../src/adapters/github/fetchTypes";

describe("listInstallationRepos", () => {
  it("returns the repositories array on success", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        repositories: [{ id: 1, name: "widgets", full_name: "acme/widgets", owner: { login: "acme" }, default_branch: "main" }],
      }),
    });

    const repos = await listInstallationRepos("token-1", fetchFn);

    expect(repos).toHaveLength(1);
    expect(repos[0]).toMatchObject({ full_name: "acme/widgets" });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.github.com/installation/repositories",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token-1" }) })
    );
  });

  it("throws when the HTTP response isn't ok", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    await expect(listInstallationRepos("bad-token", fetchFn)).rejects.toThrow(/status 403/);
  });
});
