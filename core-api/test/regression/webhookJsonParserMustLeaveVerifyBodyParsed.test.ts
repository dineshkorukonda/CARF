import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerGithubWebhookRoute } from "../../src/routes/githubWebhook.js";
import { registerPm2Route } from "../../src/routes/pm2.js";
import { hashApiKey } from "../../src/auth/apiKey.js";

const TEST_API_KEY = "carf_key_test_12345";
const TEST_KEY_HASH = hashApiKey(TEST_API_KEY);

/**
 * Production registers PM2 routes, then the GitHub webhook, which used to replace
 * Fastify's JSON parser with a raw-string parser for every application/json POST.
 * Connection check then saw request.body as a string and 400'd "Missing required fields".
 */
describe("webhook JSON parser must not leave /v1/pm2/verify with a string body", () => {
  it("parses a JSON verify payload after the webhook content-type parser is registered", async () => {
    const app = Fastify();
    await registerPm2Route(app, {
      prismaClient: {
        installationApiKey: {
          findUnique: vi.fn(async ({ where }: { where: { keyHash: string } }) =>
            where.keyHash === TEST_KEY_HASH
              ? { id: "key-1", installationId: "inst-100", keyHash: where.keyHash, createdAt: new Date() }
              : null
          ),
        },
        repoConnection: { upsert: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([{ owner: "dineshkorukonda", repo: "CARF", pm2Process: "carf-dashboard" }]) },
      } as never,
      executor: {
        exec: vi.fn(async () => ({
          stdout: JSON.stringify([{ name: "carf-dashboard", pm2_env: { status: "online" } }]),
          stderr: "",
        })),
      },
      fsAccess: vi.fn().mockResolvedValue(undefined),
      httpFetch: vi.fn().mockResolvedValue({ status: 200, text: async () => "ok" }),
    });
    await registerGithubWebhookRoute(app, {
      webhookSecret: "test-secret",
      onValidWebhook: () => undefined,
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/pm2/verify",
      headers: {
        authorization: `Bearer ${TEST_API_KEY}`,
        "content-type": "application/json",
      },
      payload: JSON.stringify({
        owner: "dineshkorukonda",
        repo: "CARF",
        target: { name: "carf-dashboard", healthUrl: "http://127.0.0.1/health", layout: "git" },
      }),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { error?: string };
    expect(body.error).not.toBe("Missing required fields: owner, repo, and target.name");
    await app.close();
  });
});
