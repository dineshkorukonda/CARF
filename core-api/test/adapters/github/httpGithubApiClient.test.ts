import { describe, expect, it, vi } from "vitest";
import { HttpGithubApiClient } from "../../../src/adapters/github/httpGithubApiClient.js";
import type { FetchFn } from "../../../src/adapters/github/fetchTypes.js";

function fakeFetch(response: { ok: boolean; status: number; json?: unknown; text?: string }): FetchFn {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.json,
    text: async () => response.text ?? "",
  });
}

describe("HttpGithubApiClient", () => {
  describe("compareCommits", () => {
    it("GETs the compare endpoint with Bearer auth and maps files to { filename, status }", async () => {
      const fetchFn = fakeFetch({
        ok: true,
        status: 200,
        json: { files: [{ filename: "src/foo.ts", status: "modified" }, { filename: "README.md", status: "added" }] },
      });
      const client = new HttpGithubApiClient(fetchFn);

      const result = await client.compareCommits("acme", "widgets", "base123", "head456", "token-abc");

      expect(fetchFn).toHaveBeenCalledWith(
        "https://api.github.com/repos/acme/widgets/compare/base123...head456",
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token-abc" }) })
      );
      expect(result).toEqual({
        files: [
          { filename: "src/foo.ts", status: "modified" },
          { filename: "README.md", status: "added" },
        ],
      });
    });

    it("treats a missing files array as no changed files", async () => {
      const fetchFn = fakeFetch({ ok: true, status: 200, json: {} });
      const client = new HttpGithubApiClient(fetchFn);

      const result = await client.compareCommits("acme", "widgets", "base123", "head456", "token-abc");

      expect(result).toEqual({ files: [] });
    });

    it("throws an HttpError-shaped object on a non-2xx response", async () => {
      const fetchFn = fakeFetch({ ok: false, status: 404, text: "No common ancestor" });
      const client = new HttpGithubApiClient(fetchFn);

      await expect(client.compareCommits("acme", "widgets", "x", "y", "token-abc")).rejects.toMatchObject({
        status: 404,
        message: "No common ancestor",
      });
    });
  });

  describe("getContent", () => {
    it("GETs the contents endpoint and base64-decodes the response", async () => {
      const decoded = "export const a = 1;\n";
      const fetchFn = fakeFetch({
        ok: true,
        status: 200,
        json: { content: Buffer.from(decoded, "utf-8").toString("base64"), encoding: "base64" },
      });
      const client = new HttpGithubApiClient(fetchFn);

      const result = await client.getContent("acme", "widgets", "src/foo.ts", "head456", "token-abc");

      expect(result).toBe(decoded);
      expect(fetchFn).toHaveBeenCalledWith(
        "https://api.github.com/repos/acme/widgets/contents/src/foo.ts?ref=head456",
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token-abc" }) })
      );
    });

    it("percent-encodes each path segment independently, preserving directory slashes", async () => {
      const fetchFn = fakeFetch({
        ok: true,
        status: 200,
        json: { content: Buffer.from("x", "utf-8").toString("base64"), encoding: "base64" },
      });
      const client = new HttpGithubApiClient(fetchFn);

      await client.getContent("acme", "widgets", "src/my file.ts", "head456", "token-abc");

      expect(fetchFn).toHaveBeenCalledWith(
        "https://api.github.com/repos/acme/widgets/contents/src/my%20file.ts?ref=head456",
        expect.anything()
      );
    });

    it("rejects with an HttpError carrying status 404, matching diffAcquisition.ts's isNotFound() check", async () => {
      const fetchFn = fakeFetch({ ok: false, status: 404, text: "Not Found" });
      const client = new HttpGithubApiClient(fetchFn);

      await expect(client.getContent("acme", "widgets", "missing.ts", "head456", "token-abc")).rejects.toMatchObject({
        status: 404,
      });
    });

    it("throws a plain Error if the response encoding isn't base64 (defensive — GitHub always returns base64 for file content today)", async () => {
      const fetchFn = fakeFetch({ ok: true, status: 200, json: { content: "x", encoding: "none" } });
      const client = new HttpGithubApiClient(fetchFn);

      await expect(client.getContent("acme", "widgets", "src/foo.ts", "head456", "token-abc")).rejects.toThrow(
        /unexpected encoding/
      );
    });
  });
});
