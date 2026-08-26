import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { registerInstallationApiKeyRoute } from "../../src/routes/installationApiKey.js";
import type { AppInfoClient, Installation } from "../../src/adapters/github/appInfoClient.js";
import type { InstallationApiKeyPrismaClient } from "../../src/auth/installationApiKeyService.js";
import { hashApiKey } from "../../src/auth/apiKey.js";

class FakeAppInfoClient implements AppInfoClient {
  constructor(
    private readonly installations: Installation[] = [],
    private readonly error?: unknown
  ) {}

  async listInstallations(): Promise<Installation[]> {
    if (this.error) throw this.error;
    return this.installations;
  }
}

class FakeInstallationApiKeyPrismaClient implements InstallationApiKeyPrismaClient {
  rows = new Map<string, { id: string; installationId: string; keyHash: string }>();
  private nextId = 1;

  installationApiKey = {
    findUnique: async (args: { where: { installationId: string } }) =>
      this.rows.get(args.where.installationId) ?? null,
    create: async (args: { data: { installationId: string; keyHash: string } }) => {
      const row = { id: `key-${this.nextId++}`, ...args.data };
      this.rows.set(args.data.installationId, row);
      return row;
    },
    upsert: async (args: {
      where: { installationId: string };
      create: { installationId: string; keyHash: string };
      update: { keyHash: string };
    }) => {
      const existing = this.rows.get(args.where.installationId);
      if (existing) {
        const updated = { ...existing, ...args.update };
        this.rows.set(args.where.installationId, updated);
        return updated;
      }
      const row = { id: `key-${this.nextId++}`, ...args.create };
      this.rows.set(args.create.installationId, row);
      return row;
    },
  };
}

describe("GET /v1/installations/:installationId/api-key", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it("returns 401 when no Authorization header is present", async () => {
    app = Fastify();
    await registerInstallationApiKeyRoute(app, { appInfoClient: new FakeAppInfoClient([]) });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/v1/installations/42/api-key" });

    expect(response.statusCode).toBe(401);
  });

  it("returns 401 when GitHub rejects the App JWT", async () => {
    app = Fastify();
    await registerInstallationApiKeyRoute(app, {
      appInfoClient: new FakeAppInfoClient([], { status: 401, message: "Bad credentials" }),
    });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/v1/installations/42/api-key",
      headers: { authorization: "Bearer bad-jwt" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns 502 when GitHub is unreachable for another reason", async () => {
    app = Fastify();
    await registerInstallationApiKeyRoute(app, {
      appInfoClient: new FakeAppInfoClient([], { status: 500, message: "Internal Server Error" }),
    });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/v1/installations/42/api-key",
      headers: { authorization: "Bearer some-jwt" },
    });

    expect(response.statusCode).toBe(502);
  });

  it("returns 404 when the JWT is valid but the installation isn't among the App's installations", async () => {
    app = Fastify();
    await registerInstallationApiKeyRoute(app, {
      appInfoClient: new FakeAppInfoClient([{ id: 99, account: "someone-else" }]),
    });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/v1/installations/42/api-key",
      headers: { authorization: "Bearer valid-jwt" },
    });

    expect(response.statusCode).toBe(404);
  });

  it("returns a fresh api key when the JWT is valid and the installation matches", async () => {
    app = Fastify();
    const prismaClient = new FakeInstallationApiKeyPrismaClient();
    await registerInstallationApiKeyRoute(app, {
      appInfoClient: new FakeAppInfoClient([{ id: 42, account: "acme" }]),
      prismaClient,
    });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/v1/installations/42/api-key",
      headers: { authorization: "Bearer valid-jwt" },
    });

    expect(response.statusCode).toBe(200);
    const { apiKey } = response.json() as { apiKey: string };
    expect(apiKey).toBeTypeOf("string");
    expect(prismaClient.rows.get("42")?.keyHash).toBe(hashApiKey(apiKey));
  });

  it("rotates (replaces) an existing key rather than reusing it", async () => {
    app = Fastify();
    const prismaClient = new FakeInstallationApiKeyPrismaClient();
    prismaClient.rows.set("42", { id: "key-1", installationId: "42", keyHash: hashApiKey("old-key") });
    await registerInstallationApiKeyRoute(app, {
      appInfoClient: new FakeAppInfoClient([{ id: 42, account: "acme" }]),
      prismaClient,
    });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/v1/installations/42/api-key",
      headers: { authorization: "Bearer valid-jwt" },
    });

    const { apiKey } = response.json() as { apiKey: string };
    expect(apiKey).not.toBe("old-key");
    expect(prismaClient.rows.get("42")?.keyHash).toBe(hashApiKey(apiKey));
    expect(prismaClient.rows.size).toBe(1);
  });
});
