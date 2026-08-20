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

class FakePrismaClient implements ThresholdRoutePrismaClient {
  rows = new Map<string, { finalThreshold: number; finalWindow: number; activeTypes: string[] }>();

  threshold = {
    findFirst: async (args: { where: { commit: { sha: string } } }) => {
      return this.rows.get(args.where.commit.sha) ?? null;
    },
  };
}

describe("GET /v1/threshold", () => {
  let app: FastifyInstance;
  let fake: FakePrismaClient;

  beforeEach(async () => {
    fake = new FakePrismaClient();
    fake.rows.set("abc123", { finalThreshold: 0.05, finalWindow: 300, activeTypes: ["infra", "config"] });

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

  it("returns 200 with finalThreshold, finalWindow, and activeTypes for a known commit", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/threshold?commit=abc123" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      finalThreshold: 0.05,
      finalWindow: 300,
      activeTypes: ["infra", "config"],
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
    app = Fastify();
    await registerThresholdRoute(app);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await prisma.commit.deleteMany({ where: { owner, repo } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("returns the persisted threshold for a processed commit", async () => {
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
});
