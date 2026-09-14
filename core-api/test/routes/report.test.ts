import Fastify, { type FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it } from "vitest";
import { registerReportRoute, type ReportRoutePrismaClient } from "../../src/routes/report.js";
import { hashApiKey } from "../../src/auth/apiKey.js";

interface FakeThresholdRow {
  finalThreshold: number;
  finalWindow: number;
  commit: { id: string; sha: string; installationId: string | null };
}

interface FakeRolloutOutcomeRow {
  commitId: string;
  installationId: string | null;
  rolledBack: boolean;
  finalErrorRate: number;
  durationMs: number;
}

class FakePrismaClient implements ReportRoutePrismaClient {
  rows = new Map<string, FakeThresholdRow>();
  apiKeys = new Map<string, string>(); // keyHash -> installationId
  createdOutcomes: FakeRolloutOutcomeRow[] = [];

  threshold = {
    findFirst: async (args: {
      where: { commit: { sha: string; installationId: string | null } };
      include?: { commit: true };
    }) => {
      const row = this.rows.get(args.where.commit.sha);
      if (!row || row.commit.installationId !== args.where.commit.installationId) return null;
      return row;
    },
  };

  installationApiKey = {
    findUnique: async (args: { where: { keyHash: string } }) => {
      const installationId = this.apiKeys.get(args.where.keyHash);
      return installationId ? { installationId } : null;
    },
  };

  rolloutOutcome = {
    create: async (args: {
      data: {
        commitId: string;
        installationId: string | null;
        rolledBack: boolean;
        finalErrorRate: number;
        durationMs: number;
      };
    }) => {
      this.createdOutcomes.push(args.data);
      return { id: "outcome-1", ...args.data };
    },
  };
}

describe("POST /v1/report", () => {
  let app: FastifyInstance;
  let fake: FakePrismaClient;

  beforeEach(async () => {
    fake = new FakePrismaClient();

    // Public commit (no installationId)
    fake.rows.set("abc123", {
      finalThreshold: 0.05,
      finalWindow: 300,
      commit: { id: "commit-1", sha: "abc123", installationId: null },
    });

    // Installation-scoped commit
    fake.rows.set("def456", {
      finalThreshold: 0.02,
      finalWindow: 180,
      commit: { id: "commit-2", sha: "def456", installationId: "inst-999" },
    });
    fake.apiKeys.set(hashApiKey("carf_valid_key_12345"), "inst-999");

    app = Fastify();
    await registerReportRoute(app, { prismaClient: fake });
    await app.ready();
  });

  it("returns 200 with continue when errorRate is below threshold", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/report",
      payload: {
        commit: "abc123",
        errorRate: 0.02,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({
      action: "continue",
      reason: "within_budget",
      finalThreshold: 0.05,
      currentErrorRate: 0.02,
      finalWindow: 300,
    });
  });

  it("returns 200 with rollback when errorRate meets or exceeds threshold and records outcome", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/report",
      payload: {
        commit: "abc123",
        errorRate: 0.06,
        durationMs: 45000,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({
      action: "rollback",
      reason: "threshold_violation",
      finalThreshold: 0.05,
      currentErrorRate: 0.06,
      finalWindow: 300,
    });

    expect(fake.createdOutcomes).toHaveLength(1);
    expect(fake.createdOutcomes[0]).toEqual({
      commitId: "commit-1",
      installationId: null,
      rolledBack: true,
      finalErrorRate: 0.06,
      durationMs: 45000,
    });
  });

  it("returns 400 when commit is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/report",
      payload: {
        errorRate: 0.02,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when errorRate is negative", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/report",
      payload: {
        commit: "abc123",
        errorRate: -0.1,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when commit is unknown", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/report",
      payload: {
        commit: "unknown-sha",
        errorRate: 0.01,
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "commit not found" });
  });

  it("requires valid installation API key for tenant-scoped commit", async () => {
    // Missing key -> 404 (does not leak existence of other tenant's commit)
    const resNoKey = await app.inject({
      method: "POST",
      url: "/v1/report",
      payload: {
        commit: "def456",
        errorRate: 0.01,
      },
    });
    expect(resNoKey.statusCode).toBe(404);

    // Invalid key -> 401
    const resBadKey = await app.inject({
      method: "POST",
      url: "/v1/report",
      headers: { authorization: "Bearer invalid_key" },
      payload: {
        commit: "def456",
        errorRate: 0.01,
      },
    });
    expect(resBadKey.statusCode).toBe(401);

    // Valid key -> 200
    const resGoodKey = await app.inject({
      method: "POST",
      url: "/v1/report",
      headers: { authorization: "Bearer carf_valid_key_12345" },
      payload: {
        commit: "def456",
        errorRate: 0.01,
      },
    });
    expect(resGoodKey.statusCode).toBe(200);
    expect(resGoodKey.json().action).toBe("continue");
  });
});
