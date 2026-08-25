import { describe, expect, it, vi } from "vitest";
import { RealInstallationTokenExchangeClient } from "../../../src/adapters/github/realInstallationTokenExchangeClient.js";
import type { FetchFn } from "../../../src/adapters/github/fetchTypes.js";

function fakeFetch(response: { ok: boolean; status: number; json?: unknown; text?: string }): FetchFn {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: async () => response.json,
    text: async () => response.text ?? "",
  });
}

describe("RealInstallationTokenExchangeClient", () => {
  it("POSTs to the installation access_tokens endpoint with the App JWT as a Bearer token", async () => {
    const fetchFn = fakeFetch({
      ok: true,
      status: 201,
      json: { token: "ghs_abc123", expires_at: "2026-01-01T00:10:00Z" },
    });
    const client = new RealInstallationTokenExchangeClient(fetchFn);

    await client.createInstallationToken("999", "app-jwt-token");

    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.github.com/app/installations/999/access_tokens",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer app-jwt-token",
          Accept: "application/vnd.github+json",
        }),
      })
    );
  });

  it("maps the response's token and expires_at (snake_case) to { token, expiresAt }", async () => {
    const fetchFn = fakeFetch({
      ok: true,
      status: 201,
      json: { token: "ghs_abc123", expires_at: "2026-01-01T00:10:00Z" },
    });
    const client = new RealInstallationTokenExchangeClient(fetchFn);

    const result = await client.createInstallationToken("999", "app-jwt-token");

    expect(result).toEqual({ token: "ghs_abc123", expiresAt: "2026-01-01T00:10:00Z" });
  });

  it("throws an HttpError-shaped object on a non-2xx response", async () => {
    const fetchFn = fakeFetch({ ok: false, status: 401, text: "Bad credentials" });
    const client = new RealInstallationTokenExchangeClient(fetchFn);

    await expect(client.createInstallationToken("999", "bad-jwt")).rejects.toMatchObject({
      status: 401,
      message: "Bad credentials",
    });
  });
});
