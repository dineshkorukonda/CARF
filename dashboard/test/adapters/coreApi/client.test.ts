import { describe, expect, it, vi } from "vitest";
import { fetchCoreApiVersion, fetchInstallationApiKey, fetchRecentCommits } from "../../../src/adapters/coreApi/client";
import type { FetchFn } from "../../../src/adapters/github/fetchTypes";

describe("fetchRecentCommits", () => {
  it("returns the parsed commit list on success", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ sha: "abc", owner: "acme", repo: "widgets", createdAt: "2026-01-01T00:00:00Z", finalThreshold: 0.05, finalWindow: 300, activeTypes: ["infra"], rolledBack: null, finalErrorRate: null }],
    });

    const commits = await fetchRecentCommits("https://core-api.example.com", "carf_key", fetchFn);

    expect(commits).toHaveLength(1);
    expect(commits[0]?.sha).toBe("abc");
    expect(fetchFn).toHaveBeenCalledWith(
      "https://core-api.example.com/v1/commits",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer carf_key" }) })
    );
  });

  it("throws when the HTTP response isn't ok", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(fetchRecentCommits("https://core-api.example.com", "bad-key", fetchFn)).rejects.toThrow(/status 401/);
  });
});

describe("fetchInstallationApiKey", () => {
  it("returns the api key on success", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ apiKey: "carf_abc" }) });

    const apiKey = await fetchInstallationApiKey("https://core-api.example.com", "42", "app-jwt", fetchFn);

    expect(apiKey).toBe("carf_abc");
    expect(fetchFn).toHaveBeenCalledWith(
      "https://core-api.example.com/v1/installations/42/api-key",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer app-jwt" }) })
    );
  });

  it("throws when the HTTP response isn't ok", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    await expect(fetchInstallationApiKey("https://core-api.example.com", "42", "app-jwt", fetchFn)).rejects.toThrow(/status 404/);
  });
});

describe("fetchCoreApiVersion", () => {
  it("returns the version info on success", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "ok",
        service: "carf-core-api",
        version: "0.1.0",
        uptime: 12.34,
      }),
    });

    const info = await fetchCoreApiVersion("https://core-api.example.com", fetchFn);

    expect(info.service).toBe("carf-core-api");
    expect(info.version).toBe("0.1.0");
    expect(fetchFn).toHaveBeenCalledWith(
      "https://core-api.example.com/v1/version",
      expect.objectContaining({ headers: { Accept: "application/json" } })
    );
  });

  it("throws when the HTTP response is not ok", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    await expect(fetchCoreApiVersion("https://core-api.example.com", fetchFn)).rejects.toThrow(/status 500/);
  });
});

