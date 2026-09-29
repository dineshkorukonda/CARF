import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateApiKey } from "../../src/auth/apiKey.js";
import type { DeployTarget } from "../../src/adapters/github/webhookPayload.js";
import { registerRefreshCommitsRoute, type RefreshCommitsPrismaClient } from "../../src/routes/refreshCommits.js";

class FakePrisma implements RefreshCommitsPrismaClient {
  known = new Set<string>();
  apiKeys = new Map<string, string>();

  commit = {
    findMany: async (args: { where: { sha: { in: string[] } } }) =>
      args.where.sha.in.filter((sha) => this.known.has(sha)).map((sha) => ({ sha })),
  };

  installationApiKey = {
    findUnique: async (args: { where: { keyHash: string } }) => {
      const installationId = this.apiKeys.get(args.where.keyHash);
      return installationId ? { installationId } : null;
    },
  };
}

describe("POST /v1/commits/refresh", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it("returns 401 without an installation API key", async () => {
    app = Fastify();
    await registerRefreshCommitsRoute(app, {
      prismaClient: new FakePrisma(),
      getInstallationToken: async () => "gh-token",
      classifyCommit: async () => undefined,
      listCommits: async () => [],
    });
    await app.ready();

    const response = await app.inject({ method: "POST", url: "/v1/commits/refresh", payload: { owner: "acme", repo: "widgets" } });
    expect(response.statusCode).toBe(401);
  });

  it("classifies only SHAs missing since the stored tip, oldest first, and does not reclassify known ones", async () => {
    const prisma = new FakePrisma();
    const key = generateApiKey();
    prisma.apiKeys.set(key.hash, "inst-1");
    prisma.known.add("tip");

    const classified: DeployTarget[] = [];
    app = Fastify();
    await registerRefreshCommitsRoute(app, {
      prismaClient: prisma,
      getInstallationToken: async () => "gh-token",
      classifyCommit: async (target) => {
        classified.push(target);
      },
      listCommits: async () => [
        { sha: "tip", parentSha: "mid" },
        { sha: "mid", parentSha: "old" },
        { sha: "old", parentSha: "base" },
      ],
    });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/v1/commits/refresh",
      headers: { authorization: `Bearer ${key.plaintext}` },
      payload: { owner: "acme", repo: "widgets", branch: "main" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      pulled: [
        { sha: "old", baseSha: "base" },
        { sha: "mid", baseSha: "old" },
      ],
      alreadyKnown: 1,
      failed: [],
    });
    expect(classified.map((target) => target.headSha)).toEqual(["old", "mid"]);
    expect(classified[0]).toMatchObject({ owner: "acme", repo: "widgets", installationId: "inst-1", event: "push", baseSha: "base" });
  });

  it("returns 400 when owner or repo is missing", async () => {
    const prisma = new FakePrisma();
    const key = generateApiKey();
    prisma.apiKeys.set(key.hash, "inst-1");
    app = Fastify();
    await registerRefreshCommitsRoute(app, {
      prismaClient: prisma,
      getInstallationToken: vi.fn(),
      classifyCommit: vi.fn(),
      listCommits: vi.fn(),
    });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/v1/commits/refresh",
      headers: { authorization: `Bearer ${key.plaintext}` },
      payload: { owner: "acme" },
    });

    expect(response.statusCode).toBe(400);
  });
});
