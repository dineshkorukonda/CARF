import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const BASE_URL = "http://localhost:3000";

const getCurrentAccount = vi.fn();
const getInstallationForAccount = vi.fn();
const ensureCoreApiKey = vi.fn();
const fetchRecentCommits = vi.fn();
const fetchPublicRepoTree = vi.fn();

vi.mock("../../src/config/env", () => ({
  env: { baseUrl: () => BASE_URL, coreApiBaseUrl: () => "http://core-api.test" },
}));

vi.mock("../../src/lib/auth", () => ({
  getCurrentAccount: () => getCurrentAccount(),
}));

vi.mock("../../src/lib/prisma", () => ({ prisma: {} }));

vi.mock("../../src/lib/accountService", () => ({
  getInstallationForAccount: (...args: unknown[]) => getInstallationForAccount(...args),
}));

vi.mock("../../src/lib/coreApiAccess", () => ({
  ensureCoreApiKey: (...args: unknown[]) => ensureCoreApiKey(...args),
}));

vi.mock("../../src/adapters/coreApi/client", () => ({
  fetchRecentCommits: (...args: unknown[]) => fetchRecentCommits(...args),
}));

// publicRepoTreeClient exports a real error class the route matches with `instanceof`, so
// re-export the genuine class rather than a stand-in.
const { RepoNotFoundError } = await import("../../src/adapters/github/publicRepoTreeClient");
vi.mock("../../src/adapters/github/publicRepoTreeClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/adapters/github/publicRepoTreeClient")>();
  return { ...actual, fetchPublicRepoTree: (...args: unknown[]) => fetchPublicRepoTree(...args) };
});

const { GET: status } = await import("../../src/app/api/status/[installationId]/route");
const { POST: compatCheck } = await import("../../src/app/api/compat-check/route");

const ACCOUNT = { id: "account-1", email: "u@e.com", passwordHash: "h", createdAt: new Date() };
const INSTALLATION = {
  id: "row-1",
  installationId: "55555",
  accountId: "account-1",
  targetLogin: "acme",
  targetType: "Organization",
  repositorySelection: "all",
  coreApiKey: "carf_key",
  createdAt: new Date(),
};

function statusRequest(installationId: string) {
  return status(new NextRequest(`${BASE_URL}/api/status/${installationId}`), {
    params: Promise.resolve({ installationId }),
  });
}

function jsonRequest(body: unknown, raw?: string): NextRequest {
  return new NextRequest(`${BASE_URL}/api/compat-check`, {
    method: "POST",
    body: raw ?? JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  for (const m of [getCurrentAccount, getInstallationForAccount, ensureCoreApiKey, fetchRecentCommits, fetchPublicRepoTree]) {
    m.mockReset();
  }
});

describe("GET /api/status/[installationId]", () => {
  it("returns the commits core-api reports for an installation the account owns", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);
    ensureCoreApiKey.mockResolvedValue("carf_key");
    fetchRecentCommits.mockResolvedValue([{ sha: "abc123" }]);

    const response = await statusRequest("55555");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ commits: [{ sha: "abc123" }] });
  });

  it("returns 401 for an unauthenticated caller, without looking anything up", async () => {
    getCurrentAccount.mockResolvedValue(null);

    const response = await statusRequest("55555");

    expect(response.status).toBe(401);
    expect(getInstallationForAccount).not.toHaveBeenCalled();
  });

  // An installationId in a URL is guessable, so ownership is checked before any key is
  // minted -- see dashboard/CLAUDE.md's note on getInstallationForAccount.
  it("returns 403 for an installation the account does not own, and mints no key", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(null);

    const response = await statusRequest("99999");

    expect(response.status).toBe(403);
    expect(ensureCoreApiKey).not.toHaveBeenCalled();
  });

  it("scopes the ownership check to the signed-in account and the requested installation", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);
    ensureCoreApiKey.mockResolvedValue("carf_key");
    fetchRecentCommits.mockResolvedValue([]);

    await statusRequest("55555");

    expect(getInstallationForAccount).toHaveBeenCalledWith(expect.anything(), "account-1", "55555");
  });

  it("returns 502 when core-api is unreachable", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);
    ensureCoreApiKey.mockResolvedValue("carf_key");
    fetchRecentCommits.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const response = await statusRequest("55555");

    expect(response.status).toBe(502);
  });

  // The installation's core-api key is a server-side secret. It must never appear in a
  // response body, not even inside an error -- see dashboard/CLAUDE.md.
  it("never leaks the core-api key in a success or an error body", async () => {
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);
    ensureCoreApiKey.mockResolvedValue("carf_super_secret_key");
    fetchRecentCommits.mockResolvedValue([{ sha: "abc" }]);

    const ok = await statusRequest("55555");
    expect(JSON.stringify(await ok.json())).not.toContain("carf_super_secret_key");

    fetchRecentCommits.mockRejectedValue(new Error("boom carf_super_secret_key"));
    const failed = await statusRequest("55555");
    expect(JSON.stringify(await failed.json())).not.toContain("carf_super_secret_key");
  });
});

describe("POST /api/compat-check", () => {
  it("scans a public repo and returns a compatibility report", async () => {
    fetchPublicRepoTree.mockResolvedValue({ paths: ["Dockerfile", "src/index.ts"], isPrivate: false, truncated: false });

    const response = await compatCheck(jsonRequest({ repoUrl: "acme/widgets" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.owner).toBe("acme");
    expect(body.repo).toBe("widgets");
    expect(body.private).toBe(false);
  });

  it("accepts a full github.com URL as well as owner/repo", async () => {
    fetchPublicRepoTree.mockResolvedValue({ paths: [], isPrivate: false, truncated: false });

    await compatCheck(jsonRequest({ repoUrl: "https://github.com/acme/widgets.git" }));

    expect(fetchPublicRepoTree).toHaveBeenCalledWith("acme", "widgets");
  });

  it("returns 400 for a body that is not valid JSON", async () => {
    const response = await compatCheck(jsonRequest(null, "{not json"));

    expect(response.status).toBe(400);
    expect(fetchPublicRepoTree).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing or blank repoUrl", async () => {
    expect((await compatCheck(jsonRequest({}))).status).toBe(400);
    expect((await compatCheck(jsonRequest({ repoUrl: "   " }))).status).toBe(400);
    expect(fetchPublicRepoTree).not.toHaveBeenCalled();
  });

  it("returns 400 for something that is not a GitHub repo reference", async () => {
    const response = await compatCheck(jsonRequest({ repoUrl: "https://gitlab.com/acme/widgets" }));

    expect(response.status).toBe(400);
    expect(fetchPublicRepoTree).not.toHaveBeenCalled();
  });

  it("explains that a private repo needs the App installed, rather than failing", async () => {
    fetchPublicRepoTree.mockResolvedValue({ paths: [], isPrivate: true, truncated: false });

    const response = await compatCheck(jsonRequest({ repoUrl: "acme/secret" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.private).toBe(true);
    expect(body.summary).toContain("private");
  });

  it("returns 404 for a repo GitHub does not have", async () => {
    fetchPublicRepoTree.mockRejectedValue(new RepoNotFoundError("acme", "nope"));

    const response = await compatCheck(jsonRequest({ repoUrl: "acme/nope" }));

    expect(response.status).toBe(404);
  });

  it("returns 502 when GitHub itself is unreachable", async () => {
    fetchPublicRepoTree.mockRejectedValue(new Error("connect ETIMEDOUT"));

    const response = await compatCheck(jsonRequest({ repoUrl: "acme/widgets" }));

    expect(response.status).toBe(502);
  });
});
