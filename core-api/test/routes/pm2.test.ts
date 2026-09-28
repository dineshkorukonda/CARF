import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { registerPm2Route } from "../../src/routes/pm2.js";
import { hashApiKey } from "../../src/auth/apiKey.js";

const TEST_API_KEY = "carf_key_test_12345";
const TEST_KEY_HASH = hashApiKey(TEST_API_KEY);

function createMockPrisma(installationId = "inst-100") {
  return {
    installationApiKey: {
      findUnique: vi.fn(async ({ where }: { where: { keyHash: string } }) => {
        if (where.keyHash === TEST_KEY_HASH) {
          return { id: "key-1", installationId, keyHash: where.keyHash, createdAt: new Date() };
        }
        return null;
      }),
    },
  };
}

describe("GET /v1/pm2/apps", () => {
  it("returns 401 when no Authorization header is provided", async () => {
    const app = Fastify();
    await registerPm2Route(app, {
      prismaClient: createMockPrisma() as any,
      executor: vi.fn().mockResolvedValue({ stdout: "[]", stderr: "" }),
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/pm2/apps",
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns 200 with sanitized PM2 app list and omits env/args", async () => {
    const app = Fastify();
    const rawPm2Output = JSON.stringify([
      {
        name: "api-server",
        pm_id: 0,
        pm2_env: {
          status: "online",
          restart_time: 2,
          pm_uptime: Date.now() - 60000,
          pm_cwd: "/var/www/app",
          env: { SECRET_TOKEN: "super-secret-do-not-leak", NODE_ENV: "production" },
          args: ["--port", "3000", "--secret", "pass123"],
        },
      },
      {
        name: "worker",
        pm_id: 1,
        pm2_env: {
          status: "errored",
          restart_time: 5,
          pm_uptime: 0,
          pm_cwd: "/var/www/worker",
        },
      },
    ]);

    const mockExecutor = {
      exec: vi.fn().mockResolvedValue({ stdout: rawPm2Output, stderr: "" }),
    };

    await registerPm2Route(app, {
      prismaClient: createMockPrisma() as any,
      executor: mockExecutor,
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/pm2/apps",
      headers: {
        authorization: `Bearer ${TEST_API_KEY}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toEqual({
      name: "api-server",
      status: "online",
      restarts: 2,
      uptime: expect.any(Number),
      cwd: "/var/www/app",
    });
    // Explicitly verify sensitive fields are NOT in the response
    expect(body[0]).not.toHaveProperty("env");
    expect(body[0]).not.toHaveProperty("args");
    expect(JSON.stringify(body)).not.toContain("super-secret-do-not-leak");
  });

  it("handles pm2 executor errors with 500", async () => {
    const app = Fastify();
    const mockExecutor = {
      exec: vi.fn().mockRejectedValue(new Error("pm2 not installed or daemon stopped")),
    };

    await registerPm2Route(app, {
      prismaClient: createMockPrisma() as any,
      executor: mockExecutor,
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/pm2/apps",
      headers: {
        authorization: `Bearer ${TEST_API_KEY}`,
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Failed to query PM2 process list on host" });
  });
});

describe("POST /v1/pm2/verify", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = Fastify();
    await registerPm2Route(app, {
      prismaClient: createMockPrisma() as any,
      executor: vi.fn(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/pm2/verify",
      payload: {
        owner: "test-owner",
        repo: "test-repo",
        target: { name: "my-app" },
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const app = Fastify();
    await registerPm2Route(app, {
      prismaClient: createMockPrisma() as any,
      executor: vi.fn(),
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/pm2/verify",
      headers: { authorization: `Bearer ${TEST_API_KEY}` },
      payload: { owner: "test-owner" },
    });

    expect(response.statusCode).toBe(400);
  });

  it("performs 5-item check and returns verified: true when all pass", async () => {
    const app = Fastify();
    const rawPm2Output = JSON.stringify([
      { name: "my-app", pm_id: 0, pm2_env: { status: "online" } },
    ]);

    const mockExecutor = {
      exec: vi.fn(async (cmd: string) => {
        if (cmd === "pm2 jlist") return { stdout: rawPm2Output, stderr: "" };
        if (cmd.startsWith("pm2 describe")) return { stdout: "describing my-app", stderr: "" };
        return { stdout: "", stderr: "" };
      }),
    };

    const mockFsAccess = vi.fn().mockResolvedValue(undefined);
    const mockHttpFetch = vi.fn().mockResolvedValue({ status: 200, text: async () => "OK" });
    const upsertFn = vi.fn().mockResolvedValue({});

    const prismaMock = {
      ...createMockPrisma(),
      repoConnection: {
        upsert: upsertFn,
      },
    };

    await registerPm2Route(app, {
      prismaClient: prismaMock as any,
      executor: mockExecutor,
      fsAccess: mockFsAccess,
      httpFetch: mockHttpFetch,
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/pm2/verify",
      headers: { authorization: `Bearer ${TEST_API_KEY}` },
      payload: {
        owner: "test-owner",
        repo: "test-repo",
        target: {
          name: "my-app",
          healthUrl: "http://localhost:3000/health",
          layout: "releases",
          releasesDir: "/var/www/releases",
          currentSymlink: "/var/www/current",
          sharedDirs: ["/var/www/shared"],
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.verified).toBe(true);
    expect(body.checks).toHaveLength(5);
    expect(body.checks.every((c: any) => c.passed)).toBe(true);

    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          verifiedAt: expect.any(Date),
        }),
      })
    );
  });

  it("returns verified: false when target app is not in PM2 process table", async () => {
    const app = Fastify();
    const mockExecutor = {
      exec: vi.fn(async (cmd: string) => {
        if (cmd === "pm2 jlist") return { stdout: "[]", stderr: "" };
        return { stdout: "", stderr: "" };
      }),
    };

    const mockFsAccess = vi.fn().mockResolvedValue(undefined);
    const mockHttpFetch = vi.fn().mockResolvedValue({ status: 200, text: async () => "OK" });
    const upsertFn = vi.fn().mockResolvedValue({});

    const prismaMock = {
      ...createMockPrisma(),
      repoConnection: {
        upsert: upsertFn,
      },
    };

    await registerPm2Route(app, {
      prismaClient: prismaMock as any,
      executor: mockExecutor,
      fsAccess: mockFsAccess,
      httpFetch: mockHttpFetch,
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/pm2/verify",
      headers: { authorization: `Bearer ${TEST_API_KEY}` },
      payload: {
        owner: "test-owner",
        repo: "test-repo",
        target: {
          name: "non-existent-app",
          healthUrl: "http://localhost:3000/health",
        },
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.verified).toBe(false);
    const targetCheck = body.checks.find((c: any) => c.id === "target_app");
    expect(targetCheck.passed).toBe(false);

    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          verifiedAt: null,
        }),
      })
    );
  });
});
