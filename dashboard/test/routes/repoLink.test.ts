import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const BASE_URL = "http://localhost:3000";

const getCurrentAccount = vi.fn();
const getInstallationForAccount = vi.fn();
const signGithubAppJwt = vi.fn();
const createInstallationToken = vi.fn();
const getCarfConfigFile = vi.fn();
const putCarfConfigFile = vi.fn();
const repoConnectionUpsert = vi.fn();

vi.mock("../../src/config/env", () => ({
  env: {
    baseUrl: () => BASE_URL,
    githubAppId: () => "app-id",
    githubAppPrivateKey: () => "private-key",
  },
}));
vi.mock("../../src/lib/auth", () => ({ getCurrentAccount: () => getCurrentAccount() }));
vi.mock("../../src/lib/prisma", () => ({
  prisma: {
    repoConnection: {
      upsert: (...args: unknown[]) => repoConnectionUpsert(...args),
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
    putCarfConfigFile: (...args: unknown[]) => putCarfConfigFile(...args),
  };
});

const { POST: linkRepo } = await import("../../src/app/api/repo/link/route");

const ACCOUNT = { id: "account-1", email: "u@e.com", createdAt: new Date() };
const INSTALLATION = {
  id: "row-1",
  installationId: "163039391",
  userId: "account-1",
  targetLogin: "dineshkorukonda",
  targetType: "User",
  repositorySelection: "all",
  coreApiKey: null,
  createdAt: new Date(),
};

describe("POST /api/repo/link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentAccount.mockResolvedValue(ACCOUNT);
    getInstallationForAccount.mockResolvedValue(INSTALLATION);
    signGithubAppJwt.mockReturnValue("jwt");
    createInstallationToken.mockResolvedValue({ token: "inst-token" });
    getCarfConfigFile.mockResolvedValue(null);
    putCarfConfigFile.mockResolvedValue(undefined);
    repoConnectionUpsert.mockResolvedValue({});
  });

  it("returns 401 when unauthenticated", async () => {
    getCurrentAccount.mockResolvedValue(null);
    const res = await linkRepo(
      new NextRequest(`${BASE_URL}/api/repo/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installationId: "1", owner: "o", repo: "r", mode: "standalone" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("commits standalone PM2 git layout fields and returns JSON with installToken", async () => {
    const res = await linkRepo(
      new NextRequest(`${BASE_URL}/api/repo/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId: "163039391",
          owner: "dineshkorukonda",
          repo: "sahaay",
          mode: "standalone",
          adapterKind: "pm2",
          adapterTarget: "sahaay",
          layout: "git",
          healthUrl: "http://127.0.0.1:3000/healthz",
          cwd: "/opt/sahaay/my-app",
          startupGraceSeconds: 15,
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(putCarfConfigFile).toHaveBeenCalled();
    const yaml = putCarfConfigFile.mock.calls[0]![2] as string;
    expect(yaml).toContain("mode: standalone");
    expect(yaml).toContain("kind: pm2");
    expect(yaml).toContain("target: sahaay");
    expect(yaml).toContain("layout: git");
    expect(yaml).toContain("cwd: /opt/sahaay/my-app");
    expect(yaml).not.toContain("version:");
    expect(repoConnectionUpsert).toHaveBeenCalled();
    const upsertArgs = repoConnectionUpsert.mock.calls[0]![0] as {
      create: { verifiedAt: Date | null; storedConfig: { target: string }; installTokenHash: string | null };
      update: { storedConfig: { target: string } };
    };
    expect(upsertArgs.create.verifiedAt).toBeNull();
    expect(upsertArgs.create.storedConfig.target).toBe("sahaay");
    expect(upsertArgs.create.installTokenHash).toBeTruthy();
    expect(upsertArgs.update.storedConfig.target).toBe("sahaay");
    const json = await res.json();
    expect(json.installToken).toBeTruthy();
  });

  it("commits augment mode without adapter and without generating installToken", async () => {
    const res = await linkRepo(
      new NextRequest(`${BASE_URL}/api/repo/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installationId: "163039391",
          owner: "dineshkorukonda",
          repo: "daily",
          mode: "augment",
          integration: "github-actions",
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(putCarfConfigFile).toHaveBeenCalled();
    const yaml = putCarfConfigFile.mock.calls[0]![2] as string;
    expect(yaml).toContain("mode: augment");
    expect(yaml).not.toContain("adapter:");
    expect(yaml).not.toContain("kind: pm2");
    expect(repoConnectionUpsert).toHaveBeenCalled();
    const upsertArgs = repoConnectionUpsert.mock.calls[0]![0] as {
      create: { verifiedAt: Date | null; storedConfig: { mode: string; integration: string }; installTokenHash: string | null };
    };
    expect(upsertArgs.create.verifiedAt).toBeNull();
    expect(upsertArgs.create.storedConfig.mode).toBe("augment");
    expect(upsertArgs.create.storedConfig.integration).toBe("github-actions");
    expect(upsertArgs.create.installTokenHash).toBeNull();
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.mode).toBe("augment");
    expect(json.integration).toBe("github-actions");
    expect(json.installToken).toBeUndefined();
  });
});
