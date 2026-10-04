import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { registerRolloutRollbackRoute } from "../../src/routes/rolloutRollback.js";
import { hashApiKey } from "../../src/auth/apiKey.js";

const TEST_API_KEY = "carf_key_test_12345";
const TEST_KEY_HASH = hashApiKey(TEST_API_KEY);

function createMockPrisma(options: {
  installationId?: string;
  rolloutOutcome?: any;
  repoConnection?: any;
} = {}) {
  const installationId = options.installationId ?? "inst-100";
  return {
    installationApiKey: {
      findUnique: vi.fn(async ({ where }: { where: { keyHash: string } }) => {
        if (where.keyHash === TEST_KEY_HASH) {
          return { id: "key-1", installationId, keyHash: where.keyHash, createdAt: new Date() };
        }
        return null;
      }),
    },
    rolloutOutcome: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (options.rolloutOutcome && options.rolloutOutcome.id === where.id) {
          return options.rolloutOutcome;
        }
        return null;
      }),
      update: vi.fn(async ({ data }: { data: any }) => data),
    },
    repoConnection: {
      findUnique: vi.fn(async () => options.repoConnection ?? null),
    },
    rolloutAuditLog: {
      create: vi.fn(async ({ data }: { data: any }) => data),
    },
    rolloutSample: {
      findMany: vi.fn(async () => [
        { id: "sample-1", rolloutId: "rollout-1", ts: new Date("2026-09-28T10:00:00Z"), errorRate: 0.02, perTarget: null },
      ]),
    },
  };
}

describe("POST /v1/rollouts/:id/rollback", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = Fastify();
    await registerRolloutRollbackRoute(app, { prismaClient: createMockPrisma() as any });

    const res = await app.inject({
      method: "POST",
      url: "/v1/rollouts/rollout-1/rollback",
    });

    expect(res.statusCode).toBe(401);
  });

  it("returns 404 when rollout belongs to a different installation", async () => {
    const app = Fastify();
    const mockPrisma = createMockPrisma({
      installationId: "inst-100",
      rolloutOutcome: {
        id: "rollout-1",
        installationId: "different-inst-999",
        owner: "org",
        repo: "api",
        commitSha: "head123",
        commit: { baseSha: "base123" },
      },
    });

    await registerRolloutRollbackRoute(app, { prismaClient: mockPrisma as any });

    const res = await app.inject({
      method: "POST",
      url: "/v1/rollouts/rollout-1/rollback",
      headers: { authorization: `Bearer ${TEST_API_KEY}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 403 when repo is not verified", async () => {
    const app = Fastify();
    const mockPrisma = createMockPrisma({
      installationId: "inst-100",
      rolloutOutcome: {
        id: "rollout-1",
        installationId: "inst-100",
        owner: "org",
        repo: "api",
        commitSha: "head123",
        commit: { baseSha: "base123" },
      },
      repoConnection: {
        id: "conn-1",
        verifiedAt: null, // not verified
      },
    });

    await registerRolloutRollbackRoute(app, { prismaClient: mockPrisma as any });

    const res = await app.inject({
      method: "POST",
      url: "/v1/rollouts/rollout-1/rollback",
      headers: { authorization: `Bearer ${TEST_API_KEY}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toContain("repository connection is not verified");
  });

  it("executes manual rollback, updates RolloutOutcome, and writes RolloutAuditLog", async () => {
    const app = Fastify();
    const mockAdapter = {
      rollback: vi.fn().mockResolvedValue(undefined),
      rollbackWithVerification: vi.fn().mockResolvedValue({ rollbackVerified: true }),
      checkHealth: vi.fn().mockResolvedValue({ healthy: true, errorRate: 0 }),
    };

    const mockPrisma = createMockPrisma({
      installationId: "inst-100",
      rolloutOutcome: {
        id: "rollout-1",
        installationId: "inst-100",
        owner: "org",
        repo: "api",
        commitSha: "head123",
        previousSha: "actual-deployed-sha",
        commit: { baseSha: "base123" },
      },
      repoConnection: {
        id: "conn-1",
        verifiedAt: new Date(),
      },
    });

    const adapterFactory = vi.fn(() => mockAdapter as any);
    await registerRolloutRollbackRoute(app, {
      prismaClient: mockPrisma as any,
      adapterFactory,
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/rollouts/rollout-1/rollback",
      headers: { authorization: `Bearer ${TEST_API_KEY}` },
      payload: { actor: "alice@example.com" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      success: true,
      rolloutId: "rollout-1",
      status: "ROLLED_BACK",
    });

    expect(mockAdapter.rollbackWithVerification).toHaveBeenCalled();
    expect(adapterFactory).toHaveBeenCalledWith("actual-deployed-sha", expect.any(String));
    expect(mockPrisma.rolloutOutcome.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rollout-1" },
        data: expect.objectContaining({
          status: "ROLLED_BACK",
          rolledBack: true,
          reason: "manual: triggered by alice@example.com",
          rollbackVerified: true,
        }),
      })
    );

    expect(mockPrisma.rolloutAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actor: "alice@example.com",
          action: "manual_rollback",
          result: "success",
        }),
      })
    );
  });
});

describe("GET /v1/rollouts/:id/samples", () => {
  it("returns samples for a rollout belonging to the installation", async () => {
    const app = Fastify();
    const mockPrisma = createMockPrisma({
      installationId: "inst-100",
      rolloutOutcome: {
        id: "rollout-1",
        installationId: "inst-100",
      },
    });

    await registerRolloutRollbackRoute(app, { prismaClient: mockPrisma as any });

    const res = await app.inject({
      method: "GET",
      url: "/v1/rollouts/rollout-1/samples",
      headers: { authorization: `Bearer ${TEST_API_KEY}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.rolloutId).toBe("rollout-1");
    expect(body.samples).toHaveLength(1);
    expect(body.samples[0].errorRate).toBe(0.02);
  });
});
