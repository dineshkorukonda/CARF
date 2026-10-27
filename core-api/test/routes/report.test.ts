import type { Prisma } from "@prisma/client";
import Fastify, { type FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it } from "vitest";
import { registerReportRoute, type ReportRoutePrismaClient } from "../../src/routes/report.js";
import { hashApiKey } from "../../src/auth/apiKey.js";

interface FakeThresholdRow {
  finalThreshold: number;
  finalWindow: number;
  commit: { id: string; sha: string; installationId: string | null; owner?: string; repo?: string };
}

class FakePrismaClient implements ReportRoutePrismaClient {
  rows = new Map<string, FakeThresholdRow>();
  apiKeys = new Map<string, string>(); // keyHash -> installationId
  createdReports: Prisma.HealthReportUncheckedCreateInput[] = [];
  failWrites = false;

  threshold = {
    findMany: async (args: Parameters<ReportRoutePrismaClient["threshold"]["findMany"]>[0]) => {
      const query = args.where.commit;
      return [...this.rows.values()].filter(row => row.commit.sha === query.sha && row.commit.installationId === query.installationId &&
        (!query.owner || row.commit.owner === query.owner) && (!query.repo || row.commit.repo === query.repo)).slice(0, args.take);
    },
  };

  installationApiKey = {
    findUnique: async (args: { where: { keyHash: string } }) => {
      const installationId = this.apiKeys.get(args.where.keyHash);
      return installationId ? { installationId } : null;
    },
  };

  healthReport = {
    create: async ({ data }: { data: Prisma.HealthReportUncheckedCreateInput }) => {
      if (this.failWrites) throw new Error("database unavailable");
      this.createdReports.push(data);
      return { id: "report-1", ...data };
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
  it("returns a retryable error when persistence fails", async () => {
    fake.failWrites = true;
    const response = await app.inject({ method: "POST", url: "/v1/report", payload: { commit: "abc123", errorRate: 1 } });
    expect(response.statusCode).toBe(503);
    expect(fake.createdReports).toHaveLength(0);
  });

  it("requires repository identity when a SHA is present in multiple repositories", async () => {
    fake.rows.get("abc123")!.commit.owner = "acme";
    fake.rows.get("abc123")!.commit.repo = "one";
    fake.rows.set("other", { finalThreshold: 0.1, finalWindow: 60,
      commit: { id: "other", sha: "abc123", installationId: null, owner: "acme", repo: "two" } });
    const payload = { commit: "abc123", errorRate: 0.01 };
    expect((await app.inject({ method: "POST", url: "/v1/report", payload })).statusCode).toBe(409);
    expect((await app.inject({ method: "POST", url: "/v1/report", payload: { ...payload, owner: "acme", repo: "two" } })).statusCode).toBe(200);
    expect(fake.createdReports[0]!.commitId).toBe("other");
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

  it("returns 200 with rollback when errorRate meets or exceeds threshold and records the verdict without claiming rollback execution", async () => {
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

    expect(fake.createdReports).toHaveLength(1);
    expect(fake.createdReports[0]).toEqual({
      commitId: "commit-1",
      installationId: null,
      action: "rollback",
      errorRate: 0.06,
      threshold: 0.05,
      window: 300,
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
