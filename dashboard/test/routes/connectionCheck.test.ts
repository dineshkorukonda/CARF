import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as connectionCheckHandler } from "../../src/app/api/repo/connection-check/route";
import { POST as pauseHandler } from "../../src/app/api/repo/pause/route";
import * as auth from "../../src/lib/auth";
import * as accountService from "../../src/lib/accountService";
import * as coreApiAccess from "../../src/lib/coreApiAccess";
import { prisma } from "../../src/lib/prisma";

vi.mock("../../src/lib/auth");
vi.mock("../../src/lib/accountService");
vi.mock("../../src/lib/coreApiAccess");
vi.mock("../../src/lib/prisma", () => ({
  prisma: {
    repoConnection: {
      upsert: vi.fn(),
    },
  },
}));

describe("POST /api/repo/connection-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CORE_API_BASE_URL = "http://localhost:4000";
  });

  it("returns 401 when account is unauthenticated", async () => {
    vi.mocked(auth.getCurrentAccount).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/repo/connection-check", {
      method: "POST",
      body: JSON.stringify({ installationId: "123", owner: "o", repo: "r", target: { name: "app" } }),
    });

    const res = await connectionCheckHandler(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when missing required body fields", async () => {
    vi.mocked(auth.getCurrentAccount).mockResolvedValue({ id: "acc-1", email: "test@example.com" } as any);

    const req = new NextRequest("http://localhost:3000/api/repo/connection-check", {
      method: "POST",
      body: JSON.stringify({ owner: "o" }),
    });

    const res = await connectionCheckHandler(req);
    expect(res.status).toBe(400);
  });

  it("proxies check to core-api and returns verification checks", async () => {
    vi.mocked(auth.getCurrentAccount).mockResolvedValue({ id: "acc-1", email: "test@example.com" } as any);
    vi.mocked(accountService.getInstallationForAccount).mockResolvedValue({ id: "inst-1", installationId: "123" } as any);
    vi.mocked(coreApiAccess.ensureCoreApiKey).mockResolvedValue("test-key");

    const mockVerificationResult = {
      verified: true,
      checks: [
        { id: "pm2_daemon", title: "PM2 Daemon Reachability", passed: true, message: "OK" },
        { id: "target_app", title: "Target Process Table Entry", passed: true, message: "OK" },
        { id: "health_url", title: "HTTP Health Probe", passed: true, message: "OK" },
        { id: "layout_paths", title: "Deployment Layout Paths", passed: true, message: "OK" },
        { id: "rollback_permission", title: "Rollback Permission Check (Dry-Run)", passed: true, message: "OK" },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockVerificationResult,
    });
    vi.stubGlobal("fetch", mockFetch);

    const req = new NextRequest("http://localhost:3000/api/repo/connection-check", {
      method: "POST",
      body: JSON.stringify({
        installationId: "123",
        owner: "test-owner",
        repo: "test-repo",
        target: { name: "test-app", healthUrl: "http://localhost:3000/health" },
      }),
    });

    const res = await connectionCheckHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.verified).toBe(true);
    expect(data.checks).toHaveLength(5);
  });
});

describe("POST /api/repo/pause", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates monitoringPaused flag for repo", async () => {
    vi.mocked(auth.getCurrentAccount).mockResolvedValue({ id: "acc-1", email: "test@example.com" } as any);
    vi.mocked(accountService.getInstallationForAccount).mockResolvedValue({ id: "inst-1", installationId: "123" } as any);
    vi.mocked(prisma.repoConnection.upsert).mockResolvedValue({
      id: "rc-1",
      installationId: 123,
      owner: "test-owner",
      repo: "test-repo",
      monitoringPaused: true,
    } as any);

    const req = new NextRequest("http://localhost:3000/api/repo/pause", {
      method: "POST",
      body: JSON.stringify({
        installationId: "123",
        owner: "test-owner",
        repo: "test-repo",
        paused: true,
      }),
    });

    const res = await pauseHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.monitoringPaused).toBe(true);
  });
});
