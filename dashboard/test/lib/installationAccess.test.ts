import { beforeEach, describe, expect, it, vi } from "vitest";

// installationAccess.ts reaches straight for the env singleton and the two GitHub adapters
// rather than taking them as arguments, so this suite mocks the modules instead of
// injecting fakes. The behaviour worth pinning is the wiring: which credential is minted
// from what, and that the caller only ever sees the token string.
const signGithubAppJwt = vi.fn();
const createInstallationToken = vi.fn();

vi.mock("../../src/config/env", () => ({
  env: {
    githubAppId: () => "app-id-123",
    githubAppPrivateKey: () => "-----BEGIN RSA PRIVATE KEY-----fake-----END RSA PRIVATE KEY-----",
  },
}));

vi.mock("../../src/adapters/github/appInstallClient", () => ({
  signGithubAppJwt: (...args: unknown[]) => signGithubAppJwt(...args),
}));

vi.mock("../../src/adapters/github/installationTokenClient", () => ({
  createInstallationToken: (...args: unknown[]) => createInstallationToken(...args),
}));

const { mintInstallationToken } = await import("../../src/lib/installationAccess");

describe("mintInstallationToken", () => {
  beforeEach(() => {
    signGithubAppJwt.mockReset();
    createInstallationToken.mockReset();
  });

  it("signs an App JWT from the configured app id and private key, then exchanges it", async () => {
    signGithubAppJwt.mockReturnValue("app-jwt");
    createInstallationToken.mockResolvedValue({ token: "ghs_installation_token" });

    const token = await mintInstallationToken("55555");

    expect(signGithubAppJwt).toHaveBeenCalledWith(
      "app-id-123",
      "-----BEGIN RSA PRIVATE KEY-----fake-----END RSA PRIVATE KEY-----"
    );
    expect(createInstallationToken).toHaveBeenCalledWith("55555", "app-jwt");
    expect(token).toBe("ghs_installation_token");
  });

  // dashboard/CLAUDE.md: the dashboard only ever authenticates to a repo as the App
  // itself. A regression that passed a user credential here would show up as the JWT no
  // longer being the value handed to the token exchange.
  it("exchanges the freshly signed JWT, never a stale or unrelated credential", async () => {
    signGithubAppJwt.mockReturnValue("jwt-minted-now");
    createInstallationToken.mockResolvedValue({ token: "t" });

    await mintInstallationToken("777");

    const [, jwtPassed] = createInstallationToken.mock.calls[0]!;
    expect(jwtPassed).toBe("jwt-minted-now");
  });

  it("mints a fresh JWT on every call rather than caching one", async () => {
    signGithubAppJwt.mockReturnValue("app-jwt");
    createInstallationToken.mockResolvedValue({ token: "t" });

    await mintInstallationToken("1");
    await mintInstallationToken("2");

    expect(signGithubAppJwt).toHaveBeenCalledTimes(2);
  });

  it("propagates a failure from the token exchange instead of returning undefined", async () => {
    signGithubAppJwt.mockReturnValue("app-jwt");
    createInstallationToken.mockRejectedValue(new Error("GitHub returned 404"));

    await expect(mintInstallationToken("99")).rejects.toThrow("GitHub returned 404");
  });
});
