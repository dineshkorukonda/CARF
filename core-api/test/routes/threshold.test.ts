// Unit tests use an in-memory fake PrismaClient (no network/DB — see core-api/CLAUDE.md's
// "external calls must be mockable" convention, applied here to the DB seam) so route
// behavior can be exercised with Fastify's inject() without a live Postgres.
//
// The live-DB describe block at the bottom exercises the real Prisma client end to end,
// mirroring the describe.skipIf(!process.env.DATABASE_URL) pattern already used in
// test/db/crud.test.ts and test/pipeline.test.ts.

import Fastify, { type FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerThresholdRoute, type ThresholdRoutePrismaClient } from "../../src/routes/threshold.js";
import { processCommit } from "../../src/pipeline.js";
import { generateApiKey } from "../../src/auth/apiKey.js";

interface FakeThresholdRow {
  finalThreshold: number;
  finalWindow: number;
  activeTypes: string[];
  installationId: string | null;
}

class FakePrismaClient implements ThresholdRoutePrismaClient {
  rows = new Map<string, FakeThresholdRow>();
  apiKeys = new Map<string, string>(); // keyHash -> installationId

  threshold = {
    findFirst: async (args: { where: { commit: { sha: string; installationId: string | null } } }) => {
      const row = this.rows.get(args.where.commit.sha);
      if (!row || row.installationId !== args.where.commit.installationId) return null;
      return row;
    },
  };

  installationApiKey = {
    findUnique: async (args: { where: { keyHash: string } }) => {
      const installationId = this.apiKeys.get(args.where.keyHash);
      return installationId ? { installationId } : null;
    },
  };
}

describe("GET /v1/threshold", () => {
  let app: FastifyInstance;
  let fake: FakePrismaClient;

  beforeEach(async () => {
    fake = new FakePrismaClient();
    fake.rows.set("abc123", {
      finalThreshold: 0.05,
      finalWindow: 300,
      activeTypes: ["infra", "config"],
      installationId: null,
    });

    app = Fastify();
    await registerThresholdRoute(app, { prismaClient: fake });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 400 when the commit query param is missing", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/threshold" });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "missing commit query param" });
  });

  it("returns 404 when no Threshold row exists for the given commit sha", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/threshold?commit=doesnotexist" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "commit not found" });
  });

  it("returns 200 unauthenticated for a commit with no installationId (self-hosted/local, no tenant to leak)", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/threshold?commit=abc123" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      finalThreshold: 0.05,
      finalWindow: 300,
      activeTypes: ["infra", "config"],
    });
  });

  describe("multi-tenant isolation (issue #65)", () => {
    let keyAPlaintext: string;

    beforeEach(() => {
      fake.rows.set("tenant-a-sha", {
        finalThreshold: 0.1,
        finalWindow: 120,
        activeTypes: ["code"],
        installationId: "inst-a",
      });
      fake.rows.set("tenant-b-sha", {
        finalThreshold: 0.2,
        finalWindow: 60,
        activeTypes: ["dependency"],
        installationId: "inst-b",
      });

      const keyA = generateApiKey();
      const keyB = generateApiKey();
      fake.apiKeys.set(keyA.hash, "inst-a");
      fake.apiKeys.set(keyB.hash, "inst-b");
      keyAPlaintext = keyA.plaintext;
    });

    it("returns 404 unauthenticated for a commit that belongs to a real installation (can't guess a tenant's SHA)", async () => {
      const response = await app.inject({ method: "GET", url: "/v1/threshold?commit=tenant-a-sha" });
      expect(response.statusCode).toBe(404);
    });

    it("returns 200 when the caller's key matches the commit's own installation", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/threshold?commit=tenant-a-sha",
        headers: { authorization: `Bearer ${keyAPlaintext}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ finalThreshold: 0.1, finalWindow: 120, activeTypes: ["code"] });
    });

    it("returns 404 (not another tenant's data) when installation A's key requests installation B's commit", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/threshold?commit=tenant-b-sha",
        headers: { authorization: `Bearer ${keyAPlaintext}` },
      });
      expect(response.statusCode).toBe(404);
    });

    it("returns 401 for an Authorization header with an unrecognized key", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/threshold?commit=tenant-a-sha",
        headers: { authorization: "Bearer carf_not-a-real-key" },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: "invalid or unrecognized API key" });
    });
  });
});

// ---------------------------------------------------------------------------
// Live-DB tests — real Postgres required, skipped otherwise (see test/db/crud.test.ts).
// ---------------------------------------------------------------------------

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("GET /v1/threshold against a live Postgres database", () => {
  const prisma = new PrismaClient();
  const owner = "threshold-route-owner";
  const repo = "threshold-route-repo";
  const repoSlug = `${owner}/${repo}`;
  let app: FastifyInstance;

  beforeEach(async () => {
    await prisma.commit.deleteMany({ where: { owner, repo } });
    await prisma.installationApiKey.deleteMany({ where: { installationId: { in: ["live-inst-a", "live-inst-b"] } } });
    app = Fastify();
    await registerThresholdRoute(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await prisma.commit.deleteMany({ where: { owner, repo } }).catch(() => undefined);
    await prisma.installationApiKey
      .deleteMany({ where: { installationId: { in: ["live-inst-a", "live-inst-b"] } } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  it("returns the persisted threshold for a processed commit with no installationId", async () => {
    const sha = "live-threshold-route-sha";
    const result = await processCommit(sha, repoSlug, [{ path: "Dockerfile", before: "", after: "FROM node:20\n" }]);

    const response = await app.inject({ method: "GET", url: `/v1/threshold?commit=${sha}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      finalThreshold: result.finalThreshold,
      finalWindow: result.finalWindow,
      activeTypes: result.activeTypes,
    });
  });

  it("returns 404 for a commit sha with no Threshold row", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/threshold?commit=unknown-live-sha" });
    expect(response.statusCode).toBe(404);
  });

  it("keeps two installations' data isolated end to end", async () => {
    const shaA = "live-tenant-a-sha";
    const shaB = "live-tenant-b-sha";
    const resultA = await processCommit(shaA, repoSlug, [{ path: "Dockerfile", before: "", after: "FROM node:20\n" }], {
      installationId: "live-inst-a",
    });
    await processCommit(shaB, repoSlug, [{ path: "Dockerfile", before: "", after: "FROM node:22\n" }], {
      installationId: "live-inst-b",
    });

    const keyA = generateApiKey();
    await prisma.installationApiKey.create({ data: { installationId: "live-inst-a", keyHash: keyA.hash } });

    const unauthenticated = await app.inject({ method: "GET", url: `/v1/threshold?commit=${shaA}` });
    expect(unauthenticated.statusCode).toBe(404);

    const ownData = await app.inject({
      method: "GET",
      url: `/v1/threshold?commit=${shaA}`,
      headers: { authorization: `Bearer ${keyA.plaintext}` },
    });
    expect(ownData.statusCode).toBe(200);
    expect(ownData.json()).toEqual({
      finalThreshold: resultA.finalThreshold,
      finalWindow: resultA.finalWindow,
      activeTypes: resultA.activeTypes,
    });

    const crossTenant = await app.inject({
      method: "GET",
      url: `/v1/threshold?commit=${shaB}`,
      headers: { authorization: `Bearer ${keyA.plaintext}` },
    });
    expect(crossTenant.statusCode).toBe(404);
  });
});
