import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/lib/auth", () => ({
  getCurrentAccount: vi.fn(),
}));

vi.mock("../../src/lib/accountService", () => ({
  listInstallationsForAccount: vi.fn(),
}));

vi.mock("../../src/adapters/github/appProbeClient", () => ({
  runGithubAppProbe: vi.fn(),
}));

vi.mock("../../src/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("../../src/config/env", () => ({
  env: {
    githubAppId: () => "app-123",
    githubAppSlug: () => "carf-cp",
    githubAppPrivateKey: () => "mock-key",
    coreApiBaseUrl: () => "https://api.carf.indevs.in",
  },
}));

import { getCurrentAccount } from "../../src/lib/auth";
import { listInstallationsForAccount, type InstallationRow, type AccountRow } from "../../src/lib/accountService";
import { runGithubAppProbe } from "../../src/adapters/github/appProbeClient";
import { GET } from "../../src/app/api/github-app/probe/route";

describe("GET /api/github-app/probe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getCurrentAccount).mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthenticated");
  });

  it("executes probe and returns probe report for authenticated account", async () => {
    const mockAccount: AccountRow = {
      id: "acc-123",
      email: "test@example.com",
      createdAt: new Date(),
    };
    vi.mocked(getCurrentAccount).mockResolvedValue(mockAccount);

    const mockInstallations: Partial<InstallationRow>[] = [
      {
        id: "inst-row-1",
        installationId: "998877",
        targetLogin: "dineshkorukonda",
        targetType: "User",
        repositorySelection: "selected",
      },
    ];
    vi.mocked(listInstallationsForAccount).mockResolvedValue(
      mockInstallations as InstallationRow[]
    );

    vi.mocked(runGithubAppProbe).mockResolvedValue({
      overallStatus: "healthy",
      timestamp: "2026-09-13T16:00:00.000Z",
      checks: {
        credentials: { status: "ok", message: "Credentials valid" },
        githubApp: { status: "ok", message: "App verified", appName: "CARF" },
        installations: { status: "ok", message: "Installations verified", totalOnGithub: 1 },
        accountSync: {
          status: "ok",
          message: "All linked",
          linkedCount: 1,
          unlinkedOnGithub: 0,
          unlinkedInstallationIds: [],
        },
        tokenAndRepos: { status: "ok", message: "Token valid", accessibleRepos: ["dineshkorukonda/CARF"] },
      },
      recommendations: [],
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.overallStatus).toBe("healthy");
    expect(body.checks.credentials.status).toBe("ok");
    expect(runGithubAppProbe).toHaveBeenCalledWith(
      expect.objectContaining({
        localInstallationIds: ["998877"],
      })
    );
  });
});
