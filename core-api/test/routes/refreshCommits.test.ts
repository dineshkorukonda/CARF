import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateApiKey } from "../../src/auth/apiKey.js";
import type { DeployTarget } from "../../src/adapters/github/webhookPayload.js";
import { EmptyChangeSetError } from "../../src/pipeline.js";
import { registerRefreshCommitsRoute, type RefreshCommitsPrismaClient } from "../../src/routes/refreshCommits.js";

const passedCi = async () => ({ ok: true, status: 200, text: async () => "", json: async () => ({ default_branch: "main", name: "CI", status: "completed", conclusion: "success", event: "push", head_sha: "a".repeat(40), head_branch: "main", repository: { full_name: "acme/widgets" }, head_repository: { full_name: "acme/widgets" } }) });

class FakePrisma implements RefreshCommitsPrismaClient {
  known = new Set<string>();
  apiKeys = new Map<string, string>();
  rollouts = new Set<string>();

  commit = {
    findMany: async (args: { where: { sha: { in: string[] } } }) =>
      args.where.sha.in.filter((sha) => this.known.has(sha)).map((sha) => ({ sha })),
  };

  rolloutOutcome = {
    findFirst: async (args: { where: { installationId: string; owner: string; repo: string; commitSha: string } }) =>
      this.rollouts.has(`${args.where.installationId}/${args.where.owner}/${args.where.repo}/${args.where.commitSha}`) ? { id: "rollout-1", status: "ROLLED_BACK", rollbackVerified: true, reason: "Health threshold exceeded" } : null,
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

  it("classifies a missing tip without deploying when requested by integration verification", async () => {
    const prisma = new FakePrisma();
    const key = generateApiKey();
    prisma.apiKeys.set(key.hash, "inst-1");
    const classifyCommit = vi.fn().mockResolvedValue(undefined);
    app = Fastify();
    await registerRefreshCommitsRoute(app, { prismaClient: prisma, getInstallationToken: async () => "token", classifyCommit, listCommits: async () => [{ sha: "tip", parentSha: "base" }] });
    const response = await app.inject({ method: "POST", url: "/v1/commits/refresh", headers: { authorization: `Bearer ${key.plaintext}` }, payload: { owner: "acme", repo: "widgets", observeLive: false } });
    expect(response.statusCode).toBe(200);
    expect(classifyCommit).toHaveBeenCalledWith(expect.objectContaining({ headSha: "tip" }), { observeLive: false });
    expect(response.json().soakSha).toBeNull();
  });

  it("does not restart a known tip's monitor during policy verification", async () => {
    const prisma = new FakePrisma();
    prisma.known.add("tip");
    const key = generateApiKey();
    prisma.apiKeys.set(key.hash, "inst-1");
    const classifyCommit = vi.fn();
    app = Fastify();
    await registerRefreshCommitsRoute(app, { prismaClient: prisma, getInstallationToken: async () => "token", classifyCommit, listCommits: async () => [{ sha: "tip", parentSha: "base" }] });
    const response = await app.inject({ method: "POST", url: "/v1/commits/refresh", headers: { authorization: `Bearer ${key.plaintext}` }, payload: { owner: "acme", repo: "widgets", observeLive: false } });
    expect(response.statusCode).toBe(200);
    expect(classifyCommit).not.toHaveBeenCalled();
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
    prisma.rollouts.add("inst-1/acme/widgets/tip");

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
      soakSha: null,
    });
    expect(classified.map((target) => target.headSha)).toEqual(["old", "mid"]);
    expect(classified[0]).toMatchObject({ owner: "acme", repo: "widgets", installationId: "inst-1", event: "push", baseSha: "base" });
  });

  it("starts a live soak for the branch tip, including a tip that is already classified with no rollout", async () => {
    const tipSha = "a".repeat(40);
    const prisma = new FakePrisma();
    const key = generateApiKey();
    prisma.apiKeys.set(key.hash, "inst-1");
    prisma.known.add(tipSha);
    prisma.known.add("mid");
    prisma.known.add("old");

    const classified: Array<{ sha: string; observeLive?: boolean | undefined }> = [];
    app = Fastify();
    await registerRefreshCommitsRoute(app, {
      prismaClient: prisma,
      getInstallationToken: async () => "gh-token",
      classifyCommit: async (target, options) => {
        classified.push({ sha: target.headSha, observeLive: options?.observeLive });
      },
      fetchFn: passedCi,
      listCommits: async () => [
        { sha: tipSha, parentSha: "mid" },
        { sha: "mid", parentSha: "old" },
        { sha: "old", parentSha: "base" },
      ],
    });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/v1/commits/refresh",
      headers: { authorization: `Bearer ${key.plaintext}` },
      payload: { owner: "acme", repo: "widgets", branch: "main", expectedSha: tipSha, ciRunId: 42, observeLive: true },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().soakSha).toBe(tipSha);
    expect(classified).toEqual([{ sha: tipSha, observeLive: true }]);
  });

  it("rejects an Actions deployment when its SHA is no longer the branch tip", async () => {
    const prisma = new FakePrisma();
    const key = generateApiKey();
    prisma.apiKeys.set(key.hash, "inst-1");
    const classifyCommit = vi.fn();
    app = Fastify();
    await registerRefreshCommitsRoute(app, { prismaClient: prisma, getInstallationToken: async () => "token", classifyCommit, fetchFn: async () => { const response = await passedCi(); return { ...response, json: async () => ({ ...await response.json(), head_sha: "c".repeat(40) }) }; }, listCommits: async () => [{ sha: "a".repeat(40), parentSha: "b".repeat(40) }] });
    const response = await app.inject({ method: "POST", url: "/v1/commits/refresh", headers: { authorization: `Bearer ${key.plaintext}` }, payload: { owner: "acme", repo: "widgets", observeLive: true, expectedSha: "c".repeat(40), ciRunId: 42 } });
    expect(response.statusCode).toBe(409);
    expect(classifyCommit).not.toHaveBeenCalled();
  });

  it("requires an exact SHA for live deployment", async () => {
    const prisma = new FakePrisma();
    const key = generateApiKey();
    prisma.apiKeys.set(key.hash, "inst-1");
    const classifyCommit = vi.fn();
    app = Fastify();
    await registerRefreshCommitsRoute(app, { prismaClient: prisma, getInstallationToken: async () => "token", classifyCommit, listCommits: vi.fn() });
    const response = await app.inject({ method: "POST", url: "/v1/commits/refresh", headers: { authorization: `Bearer ${key.plaintext}` }, payload: { owner: "acme", repo: "widgets", observeLive: true } });
    expect(response.statusCode).toBe(400);
    expect(classifyCommit).not.toHaveBeenCalled();
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

  it("rejects unpassed CI without classifying or deploying", async () => {
    const prisma = new FakePrisma();
    const key = generateApiKey();
    prisma.apiKeys.set(key.hash, "inst-1");
    const classifyCommit = vi.fn();
    const listCommits = vi.fn();
    app = Fastify();
    await registerRefreshCommitsRoute(app, { prismaClient: prisma, getInstallationToken: async () => "token", classifyCommit, listCommits, fetchFn: async () => { const response = await passedCi(); return { ...response, json: async () => ({ ...await response.json(), conclusion: "failure" }) }; } });
    const res = await app.inject({ method: "POST", url: "/v1/commits/refresh", headers: { authorization: `Bearer ${key.plaintext}` }, payload: { owner: "acme", repo: "widgets", observeLive: true, expectedSha: "a".repeat(40), ciRunId: 42 } });
    expect(res.statusCode).toBe(403);
    expect(classifyCommit).not.toHaveBeenCalled();
    expect(listCommits).not.toHaveBeenCalled();
  });
  it("reports historical empty diffs as skipped instead of classification failures", async () => {
    const prisma = new FakePrisma();
    const key = generateApiKey();
    prisma.apiKeys.set(key.hash, "inst-1");
    app = Fastify();
    await registerRefreshCommitsRoute(app, { prismaClient: prisma, getInstallationToken: async () => "token", classifyCommit: async () => { throw new EmptyChangeSetError("empty"); }, listCommits: async () => [{ sha: "empty", parentSha: "base" }] });
    const result = await app.inject({ method: "POST", url: "/v1/commits/refresh", headers: { authorization: `Bearer ${key.plaintext}` }, payload: { owner: "acme", repo: "widgets" } });
    expect(result.json()).toMatchObject({ failed: [], soakSha: null, skipped: [{ sha: "empty", reason: "Empty diff; nothing to classify" }] });
  });

  it("exposes exact-SHA rollback results only to the owning installation and repository", async () => {
    const prisma = new FakePrisma();
    const key = generateApiKey();
    const otherKey = generateApiKey();
    prisma.apiKeys.set(key.hash, "inst-1");
    prisma.apiKeys.set(otherKey.hash, "inst-2");
    const sha = "a".repeat(40);
    prisma.rollouts.add(`inst-1/acme/widgets/${sha}`);
    app = Fastify();
    await registerRefreshCommitsRoute(app, { prismaClient: prisma, getInstallationToken: vi.fn(), classifyCommit: vi.fn(), listCommits: vi.fn() });
    const url = `/v1/rollouts/status?owner=acme&repo=widgets&sha=${sha}`;
    expect((await app.inject({ url })).statusCode).toBe(401);
    expect((await app.inject({ url, headers: { authorization: `Bearer ${otherKey.plaintext}` } })).statusCode).toBe(404);
    expect((await app.inject({ url: url.replace("widgets", "other"), headers: { authorization: `Bearer ${key.plaintext}` } })).statusCode).toBe(404);
    const result = await app.inject({ url, headers: { authorization: `Bearer ${key.plaintext}` } });
    expect(result.json()).toMatchObject({ status: "ROLLED_BACK", rollbackVerified: true });
    expect((await app.inject({ url: url.replace(sha, "short"), headers: { authorization: `Bearer ${key.plaintext}` } })).statusCode).toBe(400);
  });
});
