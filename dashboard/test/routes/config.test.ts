import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Both save routes commit to a real repo's .carf.yml. The assertions that matter are the
// gates in front of that commit: authentication, installation ownership, and server-side
// re-validation of the payload.

const BASE_URL = "http://localhost:3000";

const getCurrentAccount = vi.fn();
const getInstallationForAccount = vi.fn();
const signGithubAppJwt = vi.fn();
const createInstallationToken = vi.fn();
const mintInstallationToken = vi.fn();
const getCarfConfigFile = vi.fn();
const putCarfConfigFile = vi.fn();

vi.mock("../../src/config/env", () => ({
  env: {
    baseUrl: () => BASE_URL,
    githubAppId: () => "app-id",
    githubAppPrivateKey: () => "private-key",
  },
}));

vi.mock("../../src/lib/auth", () => ({ getCurrentAccount: () => getCurrentAccount() }));
vi.mock("../../src/lib/prisma", () => ({ prisma: {} }));

vi.mock("../../src/lib/accountService", () => ({
  getInstallationForAccount: (...args: unknown[]) => getInstallationForAccount(...args),
}));

vi.mock("../../src/adapters/github/appInstallClient", () => ({
  signGithubAppJwt: (...args: unknown[]) => signGithubAppJwt(...args),
}));

vi.mock("../../src/adapters/github/installationTokenClient", () => ({
  createInstallationToken: (...args: unknown[]) => createInstallationToken(...args),
}));

vi.mock("../../src/lib/installationAccess", () => ({
  mintInstallationToken: (...args: unknown[]) => mintInstallationToken(...args),
}));

vi.mock("../../src/adapters/github/contentsClient", () => ({
  getCarfConfigFile: (...args: unknown[]) => getCarfConfigFile(...args),
  putCarfConfigFile: (...args: unknown[]) => putCarfConfigFile(...args),
}));

const { POST: save } = await import("../../src/app/api/config/save/route");
const { POST: saveRules } = await import("../../src/app/api/config/save-rules/route");

const ACCOUNT = { id: "account-1", email: "u@e.com", passwordHash: "h", createdAt: new Date() };
const INSTALLATION = {
  id: "row-1",
  installationId: "55555",
  accountId: "account-1",
  targetLogin: "acme",
  targetType: "Organization",
  repositorySelection: "all",
  coreApiKey: null,
  createdAt: new Date(),
};

function formRequest(fields: Record<string, string>): NextRequest {
  return new NextRequest(`${BASE_URL}/api/config/save`, {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
}

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest(`${BASE_URL}/api/config/save-rules`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function location(response: Response): string {
  const url = new URL(response.headers.get("location")!);
  return url.pathname + url.search;
}

const VALID_FORM = {
  installationId: "55555",
  owner: "acme",
  repo: "widgets",
  mode: "standalone",
  adapterKind: "kubernetes",
  adapterTarget: "deploy/api",
};

beforeEach(() => {
  for (const m of [
    getCurrentAccount,
    getInstallationForAccount,
    signGithubAppJwt,
    createInstallationToken,
    mintInstallationToken,
    getCarfConfigFile,
    putCarfConfigFile,
  ]) {
    m.mockReset();
  }
  signGithubAppJwt.mockReturnValue("app-jwt");
  createInstallationToken.mockResolvedValue({ token: "ghs_token" });
  mintInstallationToken.mockResolvedValue("ghs_token");
  getCarfConfigFile.mockResolvedValue(null);
  putCarfConfigFile.mockResolvedValue(undefined);
});

describe("POST /api/config/save", () => {
  it("commits the new mode/adapter and redirects back with saved=1", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);

    const response = await save(formRequest(VALID_FORM));

    expect(location(response)).toBe("/dashboard/config/55555?repo=acme%2Fwidgets&saved=1");
    expect(putCarfConfigFile).toHaveBeenCalledTimes(1);
    const [owner, repo, yaml] = putCarfConfigFile.mock.calls[0]!;
    expect([owner, repo]).toEqual(["acme", "widgets"]);
    expect(yaml).toContain("standalone");
  });

  it("redirects an unauthenticated caller to /login and commits nothing", async () => {
    getCurrentAccount.mockResolvedValue(null);

    const response = await save(formRequest(VALID_FORM));

    expect(location(response)).toBe("/login");
    expect(putCarfConfigFile).not.toHaveBeenCalled();
  });

  // Writing to a repo the account has no installation for would let any signed-in user
  // commit to somebody else's repository.
  it("refuses an installation the account does not own, and commits nothing", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(null);

    const response = await save(formRequest(VALID_FORM));

    expect(location(response)).toBe("/dashboard?error=not_authorized");
    expect(putCarfConfigFile).not.toHaveBeenCalled();
  });

  it("refuses a missing owner or repo", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);

    const response = await save(formRequest({ ...VALID_FORM, repo: "" }));

    expect(location(response)).toBe("/dashboard?error=not_authorized");
    expect(putCarfConfigFile).not.toHaveBeenCalled();
  });

  it("authenticates the commit with an installation token, never a user credential", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);

    await save(formRequest(VALID_FORM));

    expect(createInstallationToken).toHaveBeenCalledWith("55555", "app-jwt");
    expect(putCarfConfigFile.mock.calls[0]![4]).toBe("ghs_token");
  });

  it("reports save_failed when the GitHub write fails, keeping the user on the page", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);
    putCarfConfigFile.mockRejectedValue(new Error("409 conflict"));

    const response = await save(formRequest(VALID_FORM));

    expect(location(response)).toBe("/dashboard/config/55555?repo=acme%2Fwidgets&error=save_failed");
  });

  // In augment mode the adapter block is dropped rather than written with empty values.
  it("omits the adapter when the mode is augment", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);

    await save(formRequest({ ...VALID_FORM, mode: "augment" }));

    expect(putCarfConfigFile.mock.calls[0]![2]).toContain("augment");
  });

  it("passes the existing file sha through, so a concurrent edit is not clobbered", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);
    getCarfConfigFile.mockResolvedValue({ content: "mode: augment\n", sha: "existing-sha" });

    await save(formRequest(VALID_FORM));

    expect(putCarfConfigFile.mock.calls[0]![5]).toBe("existing-sha");
  });
});

describe("POST /api/config/save-rules", () => {
  const VALID_BODY = {
    installationId: "55555",
    owner: "acme",
    repo: "widgets",
    classification: { rules: [{ type: "infra", patterns: ["terraform/**"] }] },
    threshold: { decay: 0.5 },
  };

  it("commits a valid classification/threshold patch and reports ok", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);

    const response = await saveRules(jsonRequest(VALID_BODY));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(putCarfConfigFile).toHaveBeenCalledTimes(1);
  });

  it("returns 401 for an unauthenticated caller and commits nothing", async () => {
    getCurrentAccount.mockResolvedValue(null);

    const response = await saveRules(jsonRequest(VALID_BODY));

    expect(response.status).toBe(401);
    expect(putCarfConfigFile).not.toHaveBeenCalled();
  });

  it("returns 403 for an installation the account does not own", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(null);

    const response = await saveRules(jsonRequest(VALID_BODY));

    expect(response.status).toBe(403);
    expect(putCarfConfigFile).not.toHaveBeenCalled();
  });

  it("returns 400 when installationId, owner or repo is missing", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);

    const response = await saveRules(jsonRequest({ ...VALID_BODY, repo: undefined }));

    expect(response.status).toBe(400);
    expect(getInstallationForAccount).not.toHaveBeenCalled();
  });

  // The route's own doc comment: client-side validation is a UX nicety, never a substitute
  // for enforcement here. A payload that skipped the browser must still be rejected.
  it("re-validates the payload server-side and returns 400 with the issues", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);

    const response = await saveRules(jsonRequest({ ...VALID_BODY, threshold: { decay: 5 } }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.issues.length).toBeGreaterThan(0);
    expect(putCarfConfigFile).not.toHaveBeenCalled();
  });

  it("rejects a classification rule with no patterns", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);

    const response = await saveRules(
      jsonRequest({ ...VALID_BODY, classification: { rules: [{ type: "infra", patterns: [] }] } })
    );

    expect(response.status).toBe(400);
    expect(putCarfConfigFile).not.toHaveBeenCalled();
  });

  it("returns 502 when the GitHub write fails", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);
    putCarfConfigFile.mockRejectedValue(new Error("GitHub 500"));

    const response = await saveRules(jsonRequest(VALID_BODY));

    expect(response.status).toBe(502);
  });

  it("never echoes the installation token back to the caller", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);
    mintInstallationToken.mockResolvedValue("ghs_super_secret");
    putCarfConfigFile.mockRejectedValue(new Error("boom ghs_super_secret"));

    const response = await saveRules(jsonRequest(VALID_BODY));

    expect(JSON.stringify(await response.json())).not.toContain("ghs_super_secret");
  });
});
