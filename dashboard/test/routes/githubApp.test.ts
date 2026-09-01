import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GITHUB_APP_INSTALL_STATE_COOKIE } from "../../src/lib/installState";

const BASE_URL = "http://localhost:3000";

const getCurrentAccount = vi.fn();
const signGithubAppJwt = vi.fn();
const fetchInstallation = vi.fn();
const linkInstallation = vi.fn();

vi.mock("../../src/config/env", () => ({
  env: {
    baseUrl: () => BASE_URL,
    githubAppSlug: () => "carf-rollback",
    githubAppId: () => "app-id",
    githubAppPrivateKey: () => "private-key",
  },
}));

vi.mock("../../src/lib/auth", () => ({ getCurrentAccount: () => getCurrentAccount() }));
vi.mock("../../src/lib/prisma", () => ({ prisma: {} }));

vi.mock("../../src/adapters/github/appInstallClient", () => ({
  signGithubAppJwt: (...args: unknown[]) => signGithubAppJwt(...args),
  fetchInstallation: (...args: unknown[]) => fetchInstallation(...args),
}));

vi.mock("../../src/lib/accountService", () => ({
  linkInstallation: (...args: unknown[]) => linkInstallation(...args),
}));

const { GET: installStart } = await import("../../src/app/api/github-app/install/start/route");
const { GET: installCallback } = await import("../../src/app/api/github-app/install/callback/route");
const { POST: installManual } = await import("../../src/app/api/github-app/install/manual/route");

const ACCOUNT = { id: "account-1", email: "u@e.com", passwordHash: "h", createdAt: new Date() };
const GITHUB_INSTALLATION = {
  id: 55555,
  account: { login: "acme", type: "Organization" },
  repository_selection: "all",
};

function callbackRequest(query: Record<string, string>, stateCookie?: string): NextRequest {
  const url = new URL(`${BASE_URL}/api/github-app/install/callback`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const request = new NextRequest(url);
  if (stateCookie !== undefined) request.cookies.set(GITHUB_APP_INSTALL_STATE_COOKIE, stateCookie);
  return request;
}

function manualRequest(fields: Record<string, string>): NextRequest {
  return new NextRequest(`${BASE_URL}/api/github-app/install/manual`, {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
}

function location(response: Response): string {
  const url = new URL(response.headers.get("location")!);
  return url.origin === BASE_URL ? url.pathname + url.search : url.toString();
}

beforeEach(() => {
  for (const m of [getCurrentAccount, signGithubAppJwt, fetchInstallation, linkInstallation]) m.mockReset();
  signGithubAppJwt.mockReturnValue("app-jwt");
  fetchInstallation.mockResolvedValue(GITHUB_INSTALLATION);
  linkInstallation.mockResolvedValue(undefined);
});

describe("GET /api/github-app/install/start", () => {
  it("redirects to GitHub's install page for the configured App slug", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);

    const response = await installStart();

    const url = new URL(response.headers.get("location")!);
    expect(url.origin).toBe("https://github.com");
    expect(url.pathname).toBe("/apps/carf-rollback/installations/new");
  });

  it("redirects an unauthenticated caller to /login", async () => {
    getCurrentAccount.mockResolvedValue(null);

    const response = await installStart();

    expect(location(response)).toBe("/login");
  });

  // The state in the URL and the state in the cookie must be the same value, or the
  // callback's anti-CSRF comparison can never succeed.
  it("puts the same nonce in the redirect URL and the state cookie", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);

    const response = await installStart();

    const stateInUrl = new URL(response.headers.get("location")!).searchParams.get("state");
    expect(stateInUrl).toMatch(/^[0-9a-f]{32}$/);
    expect(response.cookies.get(GITHUB_APP_INSTALL_STATE_COOKIE)!.value).toBe(stateInUrl);
  });

  it("sets the state cookie httpOnly, secure, sameSite=lax and short-lived", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);

    const response = await installStart();

    const cookie = response.cookies.get(GITHUB_APP_INSTALL_STATE_COOKIE)!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(cookie.maxAge).toBe(600);
  });

  it("issues a different nonce on each visit", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);

    const first = await installStart();
    const second = await installStart();

    expect(first.cookies.get(GITHUB_APP_INSTALL_STATE_COOKIE)!.value).not.toBe(
      second.cookies.get(GITHUB_APP_INSTALL_STATE_COOKIE)!.value
    );
  });
});

describe("GET /api/github-app/install/callback", () => {
  it("links the installation and returns to the installations page", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);

    const response = await installCallback(callbackRequest({ installation_id: "55555", state: "nonce" }, "nonce"));

    expect(location(response)).toBe("/dashboard/installations");
    expect(fetchInstallation).toHaveBeenCalledWith("55555", "app-jwt");
    expect(linkInstallation).toHaveBeenCalledWith(expect.anything(), "account-1", GITHUB_INSTALLATION);
  });

  it("redirects an unauthenticated caller to /login and links nothing", async () => {
    getCurrentAccount.mockResolvedValue(null);

    const response = await installCallback(callbackRequest({ installation_id: "55555", state: "nonce" }, "nonce"));

    expect(location(response)).toBe("/login");
    expect(linkInstallation).not.toHaveBeenCalled();
  });

  // Without this check anyone could link an arbitrary installation to a victim's account by
  // luring them to a crafted callback URL.
  it("rejects a state that does not match the cookie, and links nothing", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);

    const response = await installCallback(
      callbackRequest({ installation_id: "55555", state: "attacker-nonce" }, "real-nonce")
    );

    expect(location(response)).toBe("/dashboard/installations?error=invalid_install_state");
    expect(linkInstallation).not.toHaveBeenCalled();
  });

  it("rejects a callback with no state cookie at all", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);

    const response = await installCallback(callbackRequest({ installation_id: "55555", state: "nonce" }));

    expect(location(response)).toBe("/dashboard/installations?error=invalid_install_state");
    expect(linkInstallation).not.toHaveBeenCalled();
  });

  it("rejects a callback with a missing installation_id", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);

    const response = await installCallback(callbackRequest({ state: "nonce" }, "nonce"));

    expect(location(response)).toBe("/dashboard/installations?error=invalid_install_state");
    expect(linkInstallation).not.toHaveBeenCalled();
  });

  it("reports install_link_failed when GitHub does not recognise the installation", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    fetchInstallation.mockRejectedValue(new Error("404 Not Found"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await installCallback(callbackRequest({ installation_id: "55555", state: "nonce" }, "nonce"));

    expect(location(response)).toBe("/dashboard/installations?error=install_link_failed");
    logged.mockRestore();
  });

  it("clears the single-use state cookie after a successful link", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);

    const response = await installCallback(callbackRequest({ installation_id: "55555", state: "nonce" }, "nonce"));

    expect(response.cookies.get(GITHUB_APP_INSTALL_STATE_COOKIE)?.value).toBe("");
  });
});

describe("POST /api/github-app/install/manual", () => {
  it("links an installation id the account supplies by hand", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);

    const response = await installManual(manualRequest({ installationId: "55555" }));

    expect(location(response)).toBe("/dashboard/installations");
    expect(linkInstallation).toHaveBeenCalledWith(expect.anything(), "account-1", GITHUB_INSTALLATION);
  });

  it("redirects an unauthenticated caller to /login and links nothing", async () => {
    getCurrentAccount.mockResolvedValue(null);

    const response = await installManual(manualRequest({ installationId: "55555" }));

    expect(location(response)).toBe("/login");
    expect(linkInstallation).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric installation id before calling GitHub", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);

    const response = await installManual(manualRequest({ installationId: "55555; DROP TABLE" }));

    expect(location(response)).toBe("/dashboard/installations?error=invalid_installation_id");
    expect(fetchInstallation).not.toHaveBeenCalled();
  });

  it("rejects an empty installation id", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);

    const response = await installManual(manualRequest({ installationId: "   " }));

    expect(location(response)).toBe("/dashboard/installations?error=invalid_installation_id");
    expect(fetchInstallation).not.toHaveBeenCalled();
  });

  // A bare number proves nothing on its own, so the id is verified against this App's own
  // JWT before it is linked -- otherwise an account could claim any installation.
  it("verifies the id against GitHub with the App JWT before linking", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    fetchInstallation.mockRejectedValue(new Error("404 Not Found"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await installManual(manualRequest({ installationId: "99999" }));

    expect(fetchInstallation).toHaveBeenCalledWith("99999", "app-jwt");
    expect(location(response)).toBe("/dashboard/installations?error=install_link_failed");
    expect(linkInstallation).not.toHaveBeenCalled();
    logged.mockRestore();
  });
});
