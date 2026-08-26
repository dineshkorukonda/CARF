import { describe, expect, it, vi } from "vitest";
import { createInstallationToken } from "../../../src/adapters/github/installationTokenClient";
import type { FetchFn } from "../../../src/adapters/github/fetchTypes";

describe("createInstallationToken", () => {
  it("returns the token and expiry on success", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ token: "ghs_abc123", expires_at: "2026-01-01T00:00:00Z" }),
    });

    const result = await createInstallationToken("inst-1", "app-jwt", fetchFn);

    expect(result).toEqual({ token: "ghs_abc123", expiresAt: "2026-01-01T00:00:00Z" });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.github.com/app/installations/inst-1/access_tokens",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer app-jwt" }) })
    );
  });

  it("throws when the HTTP response isn't ok", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(createInstallationToken("inst-1", "app-jwt", fetchFn)).rejects.toThrow(/status 401/);
  });
});
