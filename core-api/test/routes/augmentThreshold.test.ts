import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateApiKey } from "../../src/auth/apiKey.js";
import {
  registerAugmentThresholdRoute,
  type AugmentThresholdPrismaClient,
} from "../../src/routes/augmentThreshold.js";

interface FakeCommit {
  owner: string;
  repo: string;
  sha: string;
  installationId: string | null;
  threshold: { finalThreshold: number; finalWindow: number };
  changeVector: {
    infra: number;
    dependency: number;
    config: number;
    code: number;
    data: number;
    codeComplexity: number;
  };
}

class FakePrismaClient implements AugmentThresholdPrismaClient {
  rows: FakeCommit[] = [];
  apiKeys = new Map<string, string>();

  commit = {
    findFirst: async (args: {
      where: { owner: string; repo: string; sha: string; installationId: string | null };
    }) => {
      const row = this.rows.find(
        (r) =>
          r.owner === args.where.owner &&
          r.repo === args.where.repo &&
          r.sha === args.where.sha &&
          r.installationId === args.where.installationId
      );
      return row ?? null;
    },
  };

  installationApiKey = {
    findUnique: async (args: { where: { keyHash: string } }) => {
      const installationId = this.apiKeys.get(args.where.keyHash);
      return installationId ? { installationId } : null;
    },
  };
}

describe("GET /v1/augment/threshold", () => {
  let app: FastifyInstance;
  let fake: FakePrismaClient;

  beforeEach(async () => {
    fake = new FakePrismaClient();
    fake.rows.push({
      owner: "acme",
      repo: "widgets",
      sha: "abc123",
      installationId: null,
      threshold: { finalThreshold: 0.008, finalWindow: 48 },
      changeVector: { infra: 1, dependency: 0, config: 0, code: 0, data: 0, codeComplexity: 0 },
    });
    app = Fastify();
    await registerAugmentThresholdRoute(app, { prismaClient: fake });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 400 when owner/repo/sha are missing", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/augment/threshold?owner=acme" });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "missing owner, repo, or sha query param" });
  });

  it("returns a persisted recommendation for a local unauthenticated commit", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/augment/threshold?owner=acme&repo=widgets&sha=abc123",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      threshold: 0.008,
      window: 48,
      changeVector: {
        infra: 1,
        dependency: 0,
        config: 0,
        code: 0,
        data: 0,
        code_complexity: 0,
      },
    });
  });

  it("returns 404 for an unknown sha", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/augment/threshold?owner=acme&repo=widgets&sha=missing",
    });
    expect(response.statusCode).toBe(404);
  });

  it("computes on demand when loadChangedFiles is provided and nothing is persisted", async () => {
    await app.close();
    app = Fastify();
    await registerAugmentThresholdRoute(app, {
      prismaClient: fake,
      loadChangedFiles: async () => [{ path: "Dockerfile", before: "", after: "FROM node:20\n" }],
    });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/v1/augment/threshold?owner=acme&repo=widgets&sha=newsha",
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.changeVector.infra).toBe(1);
    expect(typeof body.threshold).toBe("number");
    expect(typeof body.window).toBe("number");
  });

  it("isolates tenant-owned commits behind the installation API key", async () => {
    const keyA = generateApiKey();
    fake.apiKeys.set(keyA.hash, "inst-a");
    fake.rows.push({
      owner: "acme",
      repo: "widgets",
      sha: "tenant-a",
      installationId: "inst-a",
      threshold: { finalThreshold: 0.04, finalWindow: 200 },
      changeVector: { infra: 0, dependency: 0, config: 1, code: 0, data: 0, codeComplexity: 0 },
    });

    const unauthenticated = await app.inject({
      method: "GET",
      url: "/v1/augment/threshold?owner=acme&repo=widgets&sha=tenant-a",
    });
    expect(unauthenticated.statusCode).toBe(404);

    const own = await app.inject({
      method: "GET",
      url: "/v1/augment/threshold?owner=acme&repo=widgets&sha=tenant-a",
      headers: { authorization: `Bearer ${keyA.plaintext}` },
    });
    expect(own.statusCode).toBe(200);
    expect(own.json().threshold).toBe(0.04);
  });
});
