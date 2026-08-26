import { describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { fetchInstallation, signGithubAppJwt } from "../../../src/adapters/github/appInstallClient";
import type { FetchFn } from "../../../src/adapters/github/fetchTypes";

describe("signGithubAppJwt", () => {
  it("signs an RS256 JWT with the App id as issuer", () => {
    // jsonwebtoken's own key parsing is exercised end-to-end elsewhere (a hand-rolled fake
    // key here would just throw on sign()); assert the call shape instead.
    const sign = vi.spyOn(jwt, "sign").mockReturnValue("signed.jwt.token" as never);

    const token = signGithubAppJwt("app-123", "irrelevant-key-contents");

    expect(token).toBe("signed.jwt.token");
    expect(sign).toHaveBeenCalledWith(
      {},
      "irrelevant-key-contents",
      expect.objectContaining({ algorithm: "RS256", issuer: "app-123", expiresIn: "10m" })
    );
    sign.mockRestore();
  });
});

describe("fetchInstallation", () => {
  it("returns the parsed installation on success", async () => {
    const fetchFn: FetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 999, account: { login: "acme", type: "Organization" }, repository_selection: "all" }),
    });

    const installation = await fetchInstallation("999", "app-jwt", fetchFn);

    expect(installation).toEqual({
      id: 999,
      account: { login: "acme", type: "Organization" },
      repository_selection: "all",
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.github.com/app/installations/999",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer app-jwt" }) })
    );
  });

  it("throws when the HTTP response isn't ok", async () => {
    const fetchFn: FetchFn = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 404, json: async () => ({}), text: async () => "Not Found" });
    await expect(fetchInstallation("999", "app-jwt", fetchFn)).rejects.toThrow(/status 404/);
  });
});
