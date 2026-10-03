import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const BASE_URL = "http://localhost:3000";

const getCurrentAccount = vi.fn();
const getInstallationForAccount = vi.fn();
const signGithubAppJwt = vi.fn();
const createInstallationToken = vi.fn();
const getCarfConfigFile = vi.fn();
const deleteCarfConfigFile = vi.fn();
const repoConnectionDeleteMany = vi.fn();

vi.mock("../../src/config/env", () => ({
  env: {
    githubAppId: () => "app-id",
    githubAppPrivateKey: () => "private-key",
  },
}));
vi.mock("../../src/lib/auth", () => ({ getCurrentAccount: () => getCurrentAccount() }));
vi.mock("../../src/lib/prisma", () => ({
  prisma: {
    repoConnection: {
      deleteMany: (...args: unknown[]) => repoConnectionDeleteMany(...args),
    },
  },
}));
vi.mock("../../src/lib/accountService", () => ({
  getInstallationForAccount: (...args: unknown[]) => getInstallationForAccount(...args),
}));
vi.mock("../../src/adapters/github/appInstallClient", () => ({
  signGithubAppJwt: (...args: unknown[]) => signGithubAppJwt(...args),
}));
vi.mock("../../src/adapters/github/installationTokenClient", () => ({
  createInstallationToken: (...args: unknown[]) => createInstallationToken(...args),
}));
vi.mock("../../src/adapters/github/contentsClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/adapters/github/contentsClient")>();
  return {
    ...actual,
    getCarfConfigFile: (...args: unknown[]) => getCarfConfigFile(...args),
    deleteCarfConfigFile: (...args: unknown[]) => deleteCarfConfigFile(...args),
  };
});

const { POST: unlinkRepo } = await import("../../src/app/api/repo/unlink/route");

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

describe("POST /api/repo/unlink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);
    signGithubAppJwt.mockReturnValue("jwt");
    createInstallationToken.mockResolvedValue({ token: "inst-token" });
    getCarfConfigFile.mockResolvedValue({ content: "mode: standalone\n", sha: "sha-1" });
    deleteCarfConfigFile.mockResolvedValue(undefined);
    repoConnectionDeleteMany.mockResolvedValue({ count: 1 });
  });

  it("returns 401 when unauthenticated", async () => {
    getCurrentAccount.mockResolvedValue(null);
    const res = await unlinkRepo(
      new NextRequest(`${BASE_URL}/api/repo/unlink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationId: "99999", owner: "acme", repo: "frontend" }),
      })
    );
    expect(res.status).toBe(401);
    expect(repoConnectionDeleteMany).not.toHaveBeenCalled();
  });

  it("deletes .carf.yml and the RepoConnection without touching rollout rows", async () => {
    const res = await unlinkRepo(
      new NextRequest(`${BASE_URL}/api/repo/unlink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationId: "99999", owner: "acme", repo: "frontend" }),
      })
    );

    expect(res.status).toBe(200);
    expect(deleteCarfConfigFile).toHaveBeenCalledWith(
      "acme",
      "frontend",
      expect.stringContaining("unlink"),
      "sha-1",
      "inst-token"
    );
    expect(repoConnectionDeleteMany).toHaveBeenCalledWith({
      where: { installationId: "99999", owner: "acme", repo: "frontend" },
    });
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("still removes the RepoConnection when .carf.yml is already gone", async () => {
    getCarfConfigFile.mockResolvedValue(null);
    const res = await unlinkRepo(
      new NextRequest(`${BASE_URL}/api/repo/unlink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationId: "99999", owner: "acme", repo: "frontend" }),
      })
    );

    expect(res.status).toBe(200);
    expect(deleteCarfConfigFile).not.toHaveBeenCalled();
    expect(repoConnectionDeleteMany).toHaveBeenCalledWith({
      where: { installationId: "99999", owner: "acme", repo: "frontend" },
    });
  });
});
