import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { registerCommitsRoute, type CommitsRoutePrismaClient } from "../../src/routes/commits.js";
import { generateApiKey } from "../../src/auth/apiKey.js";

interface FakeCommitRow {
  sha: string;
  owner: string;
  repo: string;
  installationId: string;
  createdAt: Date;
  threshold: { finalThreshold: number; finalWindow: number; activeTypes: string[] } | null;
  rolloutOutcomes: Array<{ rolledBack: boolean; finalErrorRate: number; createdAt: Date }>;
}

class FakePrismaClient implements CommitsRoutePrismaClient {
  commits: FakeCommitRow[] = [];
  apiKeys = new Map<string, string>(); // keyHash -> installationId

  commit = {
    findMany: async (args: { where: { installationId: string }; take: number }) => {
      return this.commits
        .filter((c) => c.installationId === args.where.installationId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, args.take);
    },
  };

  installationApiKey = {
    findUnique: async (args: { where: { keyHash: string } }) => {
      const installationId = this.apiKeys.get(args.where.keyHash);
      return installationId ? { installationId } : null;
    },
  };
}

describe("GET /v1/commits", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it("returns 401 with no Authorization header (no unauthenticated case for a list endpoint)", async () => {
    app = Fastify();
    await registerCommitsRoute(app, { prismaClient: new FakePrismaClient() });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/v1/commits" });

    expect(response.statusCode).toBe(401);
  });

  it("returns 401 for an unrecognized key", async () => {
    app = Fastify();
    await registerCommitsRoute(app, { prismaClient: new FakePrismaClient() });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/v1/commits",
      headers: { authorization: "Bearer carf_not-a-real-key" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns only the authenticated caller's own commits, most recent first", async () => {
    const prisma = new FakePrismaClient();
    const keyA = generateApiKey();
    const keyB = generateApiKey();
    prisma.apiKeys.set(keyA.hash, "inst-a");
    prisma.apiKeys.set(keyB.hash, "inst-b");

    prisma.commits.push(
      {
        sha: "sha-a-old",
        owner: "acme",
        repo: "widgets",
        installationId: "inst-a",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        threshold: { finalThreshold: 0.05, finalWindow: 300, activeTypes: ["infra"] },
        rolloutOutcomes: [],
      },
      {
        sha: "sha-a-new",
        owner: "acme",
        repo: "widgets",
        installationId: "inst-a",
        createdAt: new Date("2026-01-02T00:00:00Z"),
        threshold: { finalThreshold: 0.1, finalWindow: 120, activeTypes: ["code"] },
        rolloutOutcomes: [{ rolledBack: true, finalErrorRate: 0.5, createdAt: new Date() }],
      },
      {
        sha: "sha-b",
        owner: "other",
        repo: "thing",
        installationId: "inst-b",
        createdAt: new Date("2026-01-03T00:00:00Z"),
        threshold: null,
        rolloutOutcomes: [],
      }
    );

    app = Fastify();
    await registerCommitsRoute(app, { prismaClient: prisma });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/v1/commits",
      headers: { authorization: `Bearer ${keyA.plaintext}` },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as Array<{ sha: string; finalThreshold: number | null; rolledBack: boolean | null }>;
    expect(body.map((c) => c.sha)).toEqual(["sha-a-new", "sha-a-old"]);
    expect(body[0]).toMatchObject({ finalThreshold: 0.1, rolledBack: true });
    expect(body[1]).toMatchObject({ finalThreshold: 0.05, rolledBack: null });
  });

  it("returns null threshold/rollout fields for a commit that hasn't been fully processed", async () => {
    const prisma = new FakePrismaClient();
    const key = generateApiKey();
    prisma.apiKeys.set(key.hash, "inst-a");
    prisma.commits.push({
      sha: "no-signal-sha",
      owner: "acme",
      repo: "widgets",
      installationId: "inst-a",
      createdAt: new Date(),
      threshold: null,
      rolloutOutcomes: [],
    });

    app = Fastify();
    await registerCommitsRoute(app, { prismaClient: prisma });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/v1/commits",
      headers: { authorization: `Bearer ${key.plaintext}` },
    });

    expect(response.json()).toEqual([
      {
        sha: "no-signal-sha",
        owner: "acme",
        repo: "widgets",
        createdAt: expect.any(String),
        finalThreshold: null,
        finalWindow: null,
        activeTypes: [],
        rolledBack: null,
        finalErrorRate: null,
      },
    ]);
  });
});
