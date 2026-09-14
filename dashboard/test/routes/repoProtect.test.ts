import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const BASE_URL = "http://localhost:3000";

const getCurrentAccount = vi.fn();
const getInstallationForAccount = vi.fn();
const mintInstallationToken = vi.fn();
const getCarfConfigFile = vi.fn();
const putCarfConfigFile = vi.fn();
const getRepoFile = vi.fn();
const putRepoFile = vi.fn();
const listInstallationRepos = vi.fn();

vi.mock("../../src/lib/auth", () => ({ getCurrentAccount: () => getCurrentAccount() }));
vi.mock("../../src/lib/prisma", () => ({ prisma: {} }));

vi.mock("../../src/lib/accountService", () => ({
  getInstallationForAccount: (...args: unknown[]) => getInstallationForAccount(...args),
}));

vi.mock("../../src/lib/installationAccess", () => ({
  mintInstallationToken: (...args: unknown[]) => mintInstallationToken(...args),
}));

vi.mock("../../src/adapters/github/contentsClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/adapters/github/contentsClient")>();
  return {
    ...actual,
    getCarfConfigFile: (...args: unknown[]) => getCarfConfigFile(...args),
    putCarfConfigFile: (...args: unknown[]) => putCarfConfigFile(...args),
    getRepoFile: (...args: unknown[]) => getRepoFile(...args),
    putRepoFile: (...args: unknown[]) => putRepoFile(...args),
  };
});

vi.mock("../../src/adapters/github/reposClient", () => ({
  listInstallationRepos: (...args: unknown[]) => listInstallationRepos(...args),
}));

const { POST: protectRepo } = await import("../../src/app/api/repo/protect/route");
const { GET: getRepoStatus } = await import("../../src/app/api/repo/status/route");

const ACCOUNT = { id: "account-1", email: "user@example.com", passwordHash: "h", createdAt: new Date() };
const INSTALLATION = {
  id: "row-1",
  installationId: "99999",
  accountId: "account-1",
  targetLogin: "acme",
  targetType: "Organization",
  repositorySelection: "all",
  coreApiKey: null,
  createdAt: new Date(),
};

describe("POST /api/repo/protect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);
    mintInstallationToken.mockResolvedValue("gh-token-abc");
    getCarfConfigFile.mockResolvedValue(null);
    putCarfConfigFile.mockResolvedValue(undefined);
    getRepoFile.mockResolvedValue(null);
    putRepoFile.mockResolvedValue(undefined);
  });

  it("returns 401 when account is unauthenticated", async () => {
    getCurrentAccount.mockResolvedValue(null);
    const req = new NextRequest(`${BASE_URL}/api/repo/protect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installationId: "99999", owner: "acme", repo: "frontend" }),
    });

    const res = await protectRepo(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when missing required parameters", async () => {
    const req = new NextRequest(`${BASE_URL}/api/repo/protect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installationId: "99999" }),
    });

    const res = await protectRepo(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 when installation does not belong to account", async () => {
    getInstallationForAccount.mockResolvedValue(null);
    const req = new NextRequest(`${BASE_URL}/api/repo/protect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installationId: "99999", owner: "acme", repo: "frontend" }),
    });

    const res = await protectRepo(req);
    expect(res.status).toBe(403);
  });

  it("commits .carf.yml and watchdog workflow on success", async () => {
    const req = new NextRequest(`${BASE_URL}/api/repo/protect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        installationId: "99999",
        owner: "acme",
        repo: "frontend",
        preset: "standard",
        includeWorkflow: true,
      }),
    });

    const res = await protectRepo(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.filesCommitted).toContain(".carf.yml");
    expect(body.filesCommitted).toContain(".github/workflows/carf.yml");

    expect(putCarfConfigFile).toHaveBeenCalledWith(
      "acme",
      "frontend",
      expect.stringContaining("mode: balanced"),
      expect.stringContaining("1-click"),
      "gh-token-abc",
      undefined
    );

    expect(putRepoFile).toHaveBeenCalledWith(
      "acme",
      "frontend",
      ".github/workflows/carf.yml",
      expect.stringContaining("CARF Canary Watchdog"),
      expect.stringContaining("ci(carf)"),
      "gh-token-abc",
      undefined
    );
  });

  it("supports conservative preset and omits workflow when includeWorkflow is false", async () => {
    const req = new NextRequest(`${BASE_URL}/api/repo/protect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        installationId: "99999",
        owner: "acme",
        repo: "payment-service",
        preset: "conservative",
        includeWorkflow: false,
      }),
    });

    const res = await protectRepo(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filesCommitted).toEqual([".carf.yml"]);

    expect(putCarfConfigFile).toHaveBeenCalledWith(
      "acme",
      "payment-service",
      expect.stringContaining("mode: conservative"),
      expect.any(String),
      "gh-token-abc",
      undefined
    );
    expect(putRepoFile).not.toHaveBeenCalled();
  });
});

describe("GET /api/repo/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);
    mintInstallationToken.mockResolvedValue("gh-token-abc");
    listInstallationRepos.mockResolvedValue([
      { id: 1, name: "core-api", full_name: "acme/core-api", owner: { login: "acme" } },
      { id: 2, name: "dashboard", full_name: "acme/dashboard", owner: { login: "acme" } },
    ]);
  });

  it("returns 401 when unauthenticated", async () => {
    getCurrentAccount.mockResolvedValue(null);
    const req = new NextRequest(`${BASE_URL}/api/repo/status?installationId=99999`);
    const res = await getRepoStatus(req);
    expect(res.status).toBe(401);
  });

  it("returns protection status for repos in installation", async () => {
    getCarfConfigFile.mockImplementation((owner: string, repo: string) => {
      if (repo === "core-api") return Promise.resolve({ content: "mode: balanced\n", sha: "sha-1" });
      return Promise.resolve(null);
    });
    getRepoFile.mockResolvedValue(null);

    const req = new NextRequest(`${BASE_URL}/api/repo/status?installationId=99999`);
    const res = await getRepoStatus(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.statuses).toBeDefined();
    const coreApiStatus = body.statuses.find((s: { name: string }) => s.name === "core-api");
    const dashboardStatus = body.statuses.find((s: { name: string }) => s.name === "dashboard");

    expect(coreApiStatus.isProtected).toBe(true);
    expect(dashboardStatus.isProtected).toBe(false);
  });
});
