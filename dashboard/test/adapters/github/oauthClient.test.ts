import { describe, expect, it, vi } from "vitest";
import { exchangeOAuthCode, fetchGithubUser } from "../../../src/adapters/github/oauthClient";
import type { FetchFn } from "../../../src/adapters/github/fetchTypes";

describe("exchangeOAuthCode", () => {
  it("returns the access token on a successful exchange", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: "gho_abc123" }),
    });

    const token = await exchangeOAuthCode("code-1", "client-id", "client-secret", "https://dash/callback", fetchFn);

    expect(token).toBe("gho_abc123");
    expect(fetchFn).toHaveBeenCalledWith(
      "https://github.com/login/oauth/access_token",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws when the HTTP response isn't ok", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(exchangeOAuthCode("code-1", "id", "secret", "uri", fetchFn)).rejects.toThrow(/status 401/);
  });

  it("throws when the response has no access_token (e.g. a used/expired code)", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ error: "bad_verification_code" }),
    });
    await expect(exchangeOAuthCode("code-1", "id", "secret", "uri", fetchFn)).rejects.toThrow(/bad_verification_code/);
  });
});

describe("fetchGithubUser", () => {
  it("returns the parsed user on success", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 42, login: "octocat", avatar_url: "https://example.com/a.png" }),
    });

    const user = await fetchGithubUser("token-1", fetchFn);

    expect(user).toEqual({ id: 42, login: "octocat", avatar_url: "https://example.com/a.png" });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.github.com/user",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token-1" }) })
    );
  });

  it("throws when the HTTP response isn't ok", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await expect(fetchGithubUser("bad-token", fetchFn)).rejects.toThrow(/status 401/);
  });
});
