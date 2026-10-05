import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../src/lib/installationAccess", () => ({ mintInstallationToken: vi.fn(async () => "fixture-token") }));
import { getRepoCi } from "../../src/lib/repoCi";

afterEach(() => vi.unstubAllGlobals());
describe("repository CI cache", () => {
  it("coalesces viewers, caches results and keeps installations separate", async () => {
    const fetch = vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes("/branches/")
      ? { commit: { sha: "a".repeat(40) } }
      : { workflow_runs: [{ name: "CI", event: "push", id: 12, head_sha: "a".repeat(40), status: "completed", conclusion: "failure" }] } }));
    vi.stubGlobal("fetch", fetch);
    const [one, two] = await Promise.all([getRepoCi("1", "owner", "repo", "main"), getRepoCi("1", "owner", "repo", "main")]);
    expect(one).toEqual(two);
    expect(one.runs["a".repeat(40)].conclusion).toBe("failure");
    expect(fetch).toHaveBeenCalledTimes(2);
    await getRepoCi("1", "owner", "repo", "main");
    expect(fetch).toHaveBeenCalledTimes(2);
    await getRepoCi("2", "owner", "repo", "main");
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("reports unavailable rather than fabricating a waiting status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    expect((await getRepoCi("3", "owner", "repo", "main")).unavailable).toBe(true);
  });
});
