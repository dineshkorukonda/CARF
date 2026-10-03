import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as linkPost } from "../../src/app/api/repo/link/route";
import { POST as generateTokenPost } from "../../src/app/api/repo/generate-token/route";
import { POST as augmentVerifyPost } from "../../src/app/api/repo/augment-verify/route";
import { resolveRepoMode, resolveAugmentIntegration } from "../../src/lib/deploymentMode";
import { deriveRepoStatus } from "../../src/lib/repoStatusDerivation";

vi.mock("../../src/config/env", () => ({
  env: {
    baseUrl: () => "http://localhost:3000",
    githubAppId: () => "app-id",
    githubAppPrivateKey: () => "private-key",
    coreApiBaseUrl: () => "http://localhost:4000",
  },
}));

vi.mock("../../src/lib/auth", () => ({
  getCurrentAccount: vi.fn().mockResolvedValue({ id: "acc_test", email: "test@example.com" }),
}));

vi.mock("../../src/lib/installationAccess", () => ({
  verifyInstallationAccess: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../src/adapters/github/appInstallClient", () => ({
  signGithubAppJwt: vi.fn().mockReturnValue("mock_jwt"),
}));

const mockFindUniqueInstallation = vi.fn();
const mockFindFirstInstallation = vi.fn();
const mockUpsertRepoConnection = vi.fn();
const mockFindUniqueRepoConnection = vi.fn();
const mockCommitFindMany = vi.fn();

vi.mock("../../src/lib/prisma", () => ({
  prisma: {
    installation: {
      findFirst: (...args: unknown[]) => mockFindFirstInstallation(...args),
    },
    githubAppInstallation: {
      findUnique: (...args: unknown[]) => mockFindUniqueInstallation(...args),
    },
    repoConnection: {
      upsert: (...args: unknown[]) => mockUpsertRepoConnection(...args),
      findUnique: (...args: unknown[]) => mockFindUniqueRepoConnection(...args),
    },
    commit: {
      findMany: (...args: unknown[]) => mockCommitFindMany(...args),
    },
  },
}));

const mockGetCarfConfigFile = vi.fn();
const mockPutCarfConfigFile = vi.fn();
vi.mock("../../src/adapters/github/contentsClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/adapters/github/contentsClient")>();
  return {
    ...actual,
    getCarfConfigFile: (...args: unknown[]) => mockGetCarfConfigFile(...args),
    putCarfConfigFile: (...args: unknown[]) => mockPutCarfConfigFile(...args),
  };
});

const mockCreateInstallationToken = vi.fn();
vi.mock("../../src/adapters/github/installationTokenClient", () => ({
  createInstallationToken: (...args: unknown[]) => mockCreateInstallationToken(...args),
}));

describe("Onboarding Separation: Standalone vs Augment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirstInstallation.mockResolvedValue({
      userId: "acc_test",
      installationId: "12345",
    });
    mockFindUniqueInstallation.mockResolvedValue({
      installationId: "12345",
      coreApiKey: "key_mock_123",
    });
    mockFindUniqueRepoConnection.mockResolvedValue({
      id: "conn_123",
      installationId: "12345",
      owner: "acme",
      repo: "frontend-app",
      storedConfig: { mode: "augment", integration: "github-actions" },
    });
    mockCreateInstallationToken.mockResolvedValue({ token: "ghs_mock_token" });
    mockGetCarfConfigFile.mockResolvedValue(null);
    mockPutCarfConfigFile.mockResolvedValue({ commitSha: "sha_mock_commit" });
    mockUpsertRepoConnection.mockResolvedValue({
      id: "conn_123",
      installationId: "12345",
      owner: "acme",
      repo: "my-service",
    });
  });

  describe("Standalone Onboarding", () => {
    it("persists PM2 adapter config and generates a host install token", async () => {
      const req = new NextRequest("http://localhost/api/repo/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          installationId: "12345",
          owner: "acme",
          repo: "my-service",
          mode: "standalone",
          adapterKind: "pm2",
          adapterTarget: "api-daemon",
          adapterLayout: "git",
          defaultBranch: "main",
        }),
      });

      const res = await linkPost(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.mode).toBe("standalone");
      expect(json.installToken).toMatch(/^carf_inst_/);

      // Verify DB storedConfig contains standalone mode and PM2 target
      expect(mockUpsertRepoConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            storedConfig: expect.objectContaining({
              mode: "standalone",
              kind: "pm2",
              target: "api-daemon",
            }),
            installTokenHash: expect.any(String),
          }),
        })
      );

      // Verify committed .carf.yml includes pm2 adapter
      expect(mockPutCarfConfigFile).toHaveBeenCalledWith(
        "acme",
        "my-service",
        expect.stringContaining("kind: pm2"),
        expect.any(String),
        "ghs_mock_token",
        undefined
      );
    });

    it("rejects standalone setup if adapterTarget is missing", async () => {
      const req = new NextRequest("http://localhost/api/repo/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          installationId: "12345",
          owner: "acme",
          repo: "my-service",
          mode: "standalone",
          // missing adapterTarget
        }),
      });

      const res = await linkPost(req);
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error).toMatch(/adapterTarget.*required/i);
    });
  });

  describe("Augment Onboarding", () => {
    it("persists mode: augment without generating install token or PM2 config", async () => {
      const req = new NextRequest("http://localhost/api/repo/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          installationId: "12345",
          owner: "acme",
          repo: "frontend-app",
          mode: "augment",
          integration: "github-actions",
          defaultBranch: "main",
        }),
      });

      const res = await linkPost(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.mode).toBe("augment");
      expect(json.installToken).toBeUndefined();

      // Verify DB storedConfig contains augment mode and no installTokenHash
      expect(mockUpsertRepoConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            storedConfig: expect.objectContaining({
              mode: "augment",
              integration: "github-actions",
            }),
            installTokenHash: null,
            installTokenPrefix: null,
          }),
        })
      );

      // Verify committed .carf.yml does NOT mention pm2 or adapter
      const committedYaml = mockPutCarfConfigFile.mock.calls[0][2];
      expect(committedYaml).toContain("mode: augment");
      expect(committedYaml).not.toContain("pm2");
      expect(committedYaml).not.toContain("adapter:");
    });
  });

  describe("Preventing 'production' Fallback", () => {
    it("rejects generate-token if repo or owner is missing", async () => {
      const req = new NextRequest("http://localhost/api/repo/generate-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          installationId: "12345",
          // owner and repo missing
        }),
      });

      const res = await generateTokenPost(req);
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error).toMatch(/owner and repo/i);
    });
  });

  describe("Augment Policy Verification", () => {
    it("verifies policy readiness without host agent", async () => {
      mockCommitFindMany.mockResolvedValue([]);
      const req = new NextRequest("http://localhost/api/repo/augment-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          installationId: "12345",
          owner: "acme",
          repo: "frontend-app",
        }),
      });

      const res = await augmentVerifyPost(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.policyReady).toBe(true);
      expect(json.threshold).toBe(0.05);
      expect(json.window).toBe(30);
    });
  });

  describe("Mode Resolution & Compatibility", () => {
    it("correctly identifies Sahaay as standalone without breaking", () => {
      const sahaayConn = {
        owner: "dineshkorukonda",
        repo: "Sahaay",
        verifiedAt: new Date(),
        storedConfig: {
          target: "sahaay",
          layout: "git",
          cwd: "/opt/sahaay/my-app",
        },
      };

      expect(resolveRepoMode(sahaayConn)).toBe("standalone");
      const status = deriveRepoStatus({
        isConfigured: true,
        isVerified: true,
        hasPendingRollout: false,
        latestOutcomeStatus: "SUCCESS",
        totalRollouts: 19,
        mode: resolveRepoMode(sahaayConn),
      });
      expect(status).toBe("Last rollout succeeded");
    });

    it("correctly identifies augment repo as Policy Ready without PM2 verification", () => {
      const augmentConn = {
        owner: "acme",
        repo: "frontend-app",
        verifiedAt: null, // Augment has no host agent verification
        storedConfig: {
          mode: "augment",
          integration: "argo-rollouts",
        },
      };

      expect(resolveRepoMode(augmentConn)).toBe("augment");
      expect(resolveAugmentIntegration(augmentConn)).toBe("argo-rollouts");

      const status = deriveRepoStatus({
        isConfigured: true,
        isVerified: false,
        hasPendingRollout: false,
        latestOutcomeStatus: null,
        totalRollouts: 0,
        mode: "augment",
      });
      expect(status).toBe("Policy Ready");
    });
  });
});
