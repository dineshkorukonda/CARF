import { describe, expect, it, vi } from "vitest";
import { getCarfConfigFile, putCarfConfigFile } from "../../../src/adapters/github/contentsClient";
import type { FetchFn } from "../../../src/adapters/github/fetchTypes";

describe("getCarfConfigFile", () => {
  it("decodes base64 content and returns it with the file's sha", async () => {
    const yamlText = "mode: standalone\n";
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: Buffer.from(yamlText, "utf-8").toString("base64"), encoding: "base64", sha: "abc123" }),
    });

    const file = await getCarfConfigFile("acme", "widgets", "token-1", fetchFn);

    expect(file).toEqual({ content: yamlText, sha: "abc123" });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/widgets/contents/.carf.yml",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token-1" }) })
    );
  });

  it("returns null on a 404 (no .carf.yml in the repo yet)", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    expect(await getCarfConfigFile("acme", "widgets", "token-1", fetchFn)).toBeNull();
  });

  it("throws for a non-404 error status", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(getCarfConfigFile("acme", "widgets", "token-1", fetchFn)).rejects.toThrow(/status 500/);
  });
});

describe("putCarfConfigFile", () => {
  it("PUTs base64-encoded content with the given commit message and sha", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

    await putCarfConfigFile("acme", "widgets", "mode: standalone\n", "chore: update .carf.yml", "token-1", "abc123", fetchFn);

    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/widgets/contents/.carf.yml",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          message: "chore: update .carf.yml",
          content: Buffer.from("mode: standalone\n", "utf-8").toString("base64"),
          sha: "abc123",
        }),
      })
    );
  });

  it("omits sha when creating a brand-new file", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

    await putCarfConfigFile("acme", "widgets", "mode: augment\n", "chore: create .carf.yml", "token-1", undefined, fetchFn);

    const call = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const body = JSON.parse((call[1] as { body: string }).body);
    expect(body.sha).toBeUndefined();
  });

  it("throws when the HTTP response isn't ok", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({ ok: false, status: 409, text: async () => "conflict" });
    await expect(putCarfConfigFile("acme", "widgets", "mode: augment\n", "msg", "token-1", "sha", fetchFn)).rejects.toThrow(
      /status 409/
    );
  });

  it("identifies permissions issues when GitHub returns 403", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ message: "Resource not accessible by integration" }),
    });

    try {
      await putCarfConfigFile("acme", "widgets", "mode: augment\n", "msg", "token-1", undefined, fetchFn);
      expect.unreachable("should have thrown");
    } catch (err: unknown) {
      const gErr = err as import("../../../src/adapters/github/contentsClient").GitHubContentsError;
      expect(gErr.reason).toBe("permissions");
      expect(gErr.status).toBe(403);
    }
  });

  it("identifies branch protection issues when GitHub rejects commit on protected branch", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ message: "Commit was rejected: branch main is protected" }),
    });

    try {
      await putCarfConfigFile("acme", "widgets", "mode: augment\n", "msg", "token-1", undefined, fetchFn);
      expect.unreachable("should have thrown");
    } catch (err: unknown) {
      const gErr = err as import("../../../src/adapters/github/contentsClient").GitHubContentsError;
      expect(gErr.reason).toBe("branch_protected");
      expect(gErr.status).toBe(403);
    }
  });
});

describe("getRepoFile and putRepoFile", () => {
  it("fetches arbitrary file from repo and decodes base64", async () => {
    const { getRepoFile } = await import("../../../src/adapters/github/contentsClient");
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ content: Buffer.from("name: ci\n", "utf-8").toString("base64"), encoding: "base64", sha: "wf123" }),
    });

    const file = await getRepoFile("acme", "widgets", ".github/workflows/carf.yml", "token-1", fetchFn);
    expect(file).toEqual({ content: "name: ci\n", sha: "wf123" });
  });

  it("puts arbitrary file to repo", async () => {
    const { putRepoFile } = await import("../../../src/adapters/github/contentsClient");
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

    await putRepoFile("acme", "widgets", ".github/workflows/carf.yml", "name: carf\n", "add workflow", "token-1", undefined, fetchFn);

    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.github.com/repos/acme/widgets/contents/.github/workflows/carf.yml",
      expect.objectContaining({
        method: "PUT",
      })
    );
  });
});

