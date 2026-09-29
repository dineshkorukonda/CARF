import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as heartbeatHandler } from "../../src/app/api/agent/heartbeat/route";
import { GET as configHandler } from "../../src/app/api/agent/config/route";
import { POST as rolloutOutcomeHandler } from "../../src/app/api/agent/rollout-outcome/route";
import { POST as revokeHandler } from "../../src/app/api/repo/revoke-agent/route";
import { hashInstallToken } from "../../src/lib/agentToken";
import { prisma } from "../../src/lib/prisma";
import * as auth from "../../src/lib/auth";
import * as accountService from "../../src/lib/accountService";

vi.mock("../../src/lib/auth");
vi.mock("../../src/lib/accountService");
vi.mock("../../src/lib/prisma", () => ({
  prisma: {
    repoConnection: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    commit: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    rolloutOutcome: {
      upsert: vi.fn(),
    },
    rolloutSample: {
      createMany: vi.fn(),
    },
  },
}));

describe("Agent API Routes", () => {
  const validToken = "carf_inst_0123456789abcdef0123456789abcdef0123456789abcdef";
  const validHash = hashInstallToken(validToken);

  const mockConnection = {
    id: "conn-1",
    installationId: "inst-1",
    owner: "octocat",
    repo: "hello-world",
    installTokenHash: validHash,
    installTokenPrefix: "carf_inst_0123",
    agentRevoked: false,
    storedConfig: { mode: "standalone", adapter: { kind: "pm2", target: "my-app" } },
    monitoringPaused: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/agent/heartbeat", () => {
    it("returns 401 when authorization header is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/agent/heartbeat", {
        method: "POST",
      });
      const res = await heartbeatHandler(req);
      expect(res.status).toBe(401);
    });

    it("returns 401 when token is invalid or not found", async () => {
      vi.mocked(prisma.repoConnection.findFirst).mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/agent/heartbeat", {
        method: "POST",
        headers: { Authorization: "Bearer bad_token" },
      });
      const res = await heartbeatHandler(req);
      expect(res.status).toBe(401);
    });

    it("returns 200 and records heartbeat on valid token", async () => {
      vi.mocked(prisma.repoConnection.findFirst).mockResolvedValue(mockConnection as any);
      vi.mocked(prisma.repoConnection.update).mockResolvedValue({} as any);

      const checks = [
        { id: "pm2_daemon", title: "PM2 Daemon Reachability", passed: true, message: "OK" },
        { id: "target_app", title: "Target Process Table Entry", passed: true, message: "OK" },
      ];

      const req = new NextRequest("http://localhost:3000/api/agent/heartbeat", {
        method: "POST",
        headers: { Authorization: `Bearer ${validToken}` },
        body: JSON.stringify({ version: "0.1.0", checks }),
      });

      const res = await heartbeatHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.status).toBe("online");
      expect(prisma.repoConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "conn-1" },
          data: expect.objectContaining({
            agentVersion: "0.1.0",
            verifiedAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe("GET /api/agent/config", () => {
    it("returns 401 without auth", async () => {
      const req = new NextRequest("http://localhost:3000/api/agent/config");
      const res = await configHandler(req);
      expect(res.status).toBe(401);
    });

    it("returns 200 and config when token is valid", async () => {
      vi.mocked(prisma.repoConnection.findFirst).mockResolvedValue(mockConnection as any);

      const req = new NextRequest("http://localhost:3000/api/agent/config", {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      const res = await configHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.owner).toBe("octocat");
      expect(data.repo).toBe("hello-world");
      expect(data.config).toEqual(mockConnection.storedConfig);
    });
  });

  describe("POST /api/agent/rollout-outcome", () => {
    it("returns 400 when missing commitSha or status", async () => {
      vi.mocked(prisma.repoConnection.findFirst).mockResolvedValue(mockConnection as any);

      const req = new NextRequest("http://localhost:3000/api/agent/rollout-outcome", {
        method: "POST",
        headers: { Authorization: `Bearer ${validToken}` },
        body: JSON.stringify({ commitSha: "abc" }),
      });
      const res = await rolloutOutcomeHandler(req);
      expect(res.status).toBe(400);
    });

    it("returns 200 and persists rollout outcome and samples", async () => {
      vi.mocked(prisma.repoConnection.findFirst).mockResolvedValue(mockConnection as any);
      vi.mocked(prisma.commit.findFirst).mockResolvedValue({ id: "cmt-123" } as any);
      vi.mocked(prisma.rolloutOutcome.upsert).mockResolvedValue({
        id: "ro-1",
        commitSha: "abc1234",
        status: "ROLLED_BACK",
      } as any);
      vi.mocked(prisma.rolloutSample.createMany).mockResolvedValue({ count: 1 } as any);

      const req = new NextRequest("http://localhost:3000/api/agent/rollout-outcome", {
        method: "POST",
        headers: { Authorization: `Bearer ${validToken}` },
        body: JSON.stringify({
          commitSha: "abc1234",
          status: "ROLLED_BACK",
          threshold: 0.04,
          window: 45,
          finalErrorRate: 0.5,
          rolledBack: true,
          reason: "Health check 503",
          samples: [{ ts: new Date().toISOString(), errorRate: 0.5 }],
        }),
      });

      const res = await rolloutOutcomeHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.rolloutId).toBe("ro-1");
      expect(prisma.rolloutOutcome.upsert).toHaveBeenCalled();
      expect(prisma.rolloutSample.createMany).toHaveBeenCalled();
    });
  });

  describe("POST /api/repo/revoke-agent", () => {
    it("returns 401 when user is not logged in", async () => {
      vi.mocked(auth.getCurrentAccount).mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/repo/revoke-agent", {
        method: "POST",
        body: JSON.stringify({ installationId: "inst-1", owner: "octocat", repo: "hello-world" }),
      });
      const res = await revokeHandler(req);
      expect(res.status).toBe(401);
    });

    it("revokes agent and clears token hash", async () => {
      vi.mocked(auth.getCurrentAccount).mockResolvedValue({ id: "acc-1" } as any);
      vi.mocked(accountService.getInstallationForAccount).mockResolvedValue({ id: "inst-1" } as any);
      vi.mocked(prisma.repoConnection.findUnique).mockResolvedValue(mockConnection as any);
      vi.mocked(prisma.repoConnection.update).mockResolvedValue({} as any);

      const req = new NextRequest("http://localhost:3000/api/repo/revoke-agent", {
        method: "POST",
        body: JSON.stringify({ installationId: "inst-1", owner: "octocat", repo: "hello-world" }),
      });
      const res = await revokeHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.agentStatus).toBe("revoked");
      expect(prisma.repoConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "conn-1" },
          data: {
            agentRevoked: true,
            installTokenHash: null,
            installTokenPrefix: null,
          },
        })
      );
    });
  });
});
