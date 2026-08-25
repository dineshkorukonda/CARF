import { describe, expect, it, vi } from "vitest";
import { GitOpsAdapter } from "../../src/adapters/gitops.js";
import type { FetchFn } from "../../src/adapters/gitops.js";

function fakeFetch(response: { ok: boolean; status: number; json?: unknown }): FetchFn {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.json,
  });
}

describe("GitOpsAdapter.checkHealth", () => {
  it("reports healthy with errorRate 0 when the application's health status is Healthy", async () => {
    const fetchFn = fakeFetch({ ok: true, status: 200, json: { status: { health: { status: "Healthy" } } } });
    const adapter = new GitOpsAdapter("abc123", "https://argocd.example.com", "token-xyz", { fetch: fetchFn });

    const result = await adapter.checkHealth("my-app");

    expect(fetchFn).toHaveBeenCalledWith(
      "https://argocd.example.com/api/v1/applications/my-app",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token-xyz" }) })
    );
    expect(result).toEqual({ errorRate: 0, healthy: true });
  });

  it("reports unhealthy with errorRate 1 when the health status isn't Healthy", async () => {
    const fetchFn = fakeFetch({ ok: true, status: 200, json: { status: { health: { status: "Degraded" } } } });
    const adapter = new GitOpsAdapter("abc123", "https://argocd.example.com", "token-xyz", { fetch: fetchFn });

    const result = await adapter.checkHealth("my-app");

    expect(result).toEqual({ errorRate: 1, healthy: false });
  });

  it("treats a non-2xx response as fully unhealthy", async () => {
    const fetchFn = fakeFetch({ ok: false, status: 404 });
    const adapter = new GitOpsAdapter("abc123", "https://argocd.example.com", "token-xyz", { fetch: fetchFn });

    const result = await adapter.checkHealth("my-app");

    expect(result).toEqual({ errorRate: 1, healthy: false });
  });
});

describe("GitOpsAdapter.rollback", () => {
  it("looks up the history entry matching previousRevision, then calls rollback with its id", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: {
            history: [
              { id: 1, revision: "older-sha" },
              { id: 2, revision: "abc123" },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    const adapter = new GitOpsAdapter("abc123", "https://argocd.example.com", "token-xyz", { fetch: fetchFn });

    await adapter.rollback("my-app");

    expect(fetchFn).toHaveBeenNthCalledWith(1, "https://argocd.example.com/api/v1/applications/my-app", expect.anything());
    expect(fetchFn).toHaveBeenNthCalledWith(
      2,
      "https://argocd.example.com/api/v1/applications/my-app/rollback",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ id: 2 }),
      })
    );
  });

  it("throws when no history entry matches previousRevision", async () => {
    const fetchFn = fakeFetch({
      ok: true,
      status: 200,
      json: { status: { history: [{ id: 1, revision: "some-other-sha" }] } },
    });
    const adapter = new GitOpsAdapter("abc123", "https://argocd.example.com", "token-xyz", { fetch: fetchFn });

    await expect(adapter.rollback("my-app")).rejects.toThrow(/no deployment history entry/i);
  });

  it("throws when the history lookup request fails", async () => {
    const fetchFn = fakeFetch({ ok: false, status: 500 });
    const adapter = new GitOpsAdapter("abc123", "https://argocd.example.com", "token-xyz", { fetch: fetchFn });

    await expect(adapter.rollback("my-app")).rejects.toThrow(/failed to fetch application/i);
  });

  it("throws when the rollback request itself fails", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: { history: [{ id: 2, revision: "abc123" }] } }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    const adapter = new GitOpsAdapter("abc123", "https://argocd.example.com", "token-xyz", { fetch: fetchFn });

    await expect(adapter.rollback("my-app")).rejects.toThrow(/rollback request failed/i);
  });
});
