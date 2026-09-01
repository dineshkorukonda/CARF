import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { describe, expect, it, afterEach, vi } from "vitest";
import { buildApp } from "../../src/app.js";

const webhookSecret = "test-secret";

function sign(body: string): string {
  return "sha256=" + crypto.createHmac("sha256", webhookSecret).update(body).digest("hex");
}

describe("server smoke test", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("boots and responds 200 {status: ok} on GET /healthz", async () => {
    app = buildApp();
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("does not register POST /webhooks/github when the webhook option is omitted", async () => {
    app = buildApp();
    await app.ready();

    const response = await app.inject({ method: "POST", url: "/webhooks/github", payload: "{}" });

    expect(response.statusCode).toBe(404);
  });

  it("registers POST /webhooks/github and invokes onValidWebhook when the webhook option is provided", async () => {
    const onValidWebhook = vi.fn();
    app = buildApp({ webhook: { webhookSecret, onValidWebhook } });
    await app.ready();

    const body = JSON.stringify({
      before: "abc111",
      after: "def222",
      repository: { name: "widgets", owner: { login: "acme" } },
      installation: { id: 12345 },
    });

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "content-type": "application/json",
        "x-github-event": "push",
        "x-hub-signature-256": sign(body),
      },
      payload: body,
    });

    expect(response.statusCode).toBe(202);
    expect(onValidWebhook).toHaveBeenCalledTimes(1);
  });

  // buildApp registers five routes. The existing cases above cover /healthz and the
  // conditional webhook route; nothing proved the other four were wired up at all. A
  // registration that silently stopped happening -- a dropped `void register...` line, a
  // renamed path -- would leave every unit test in test/routes/ green, because those
  // register the route themselves rather than going through buildApp.
  //
  // Asserting "not 404" rather than a success code keeps this a smoke test: these routes
  // need a database and an Authorization header to answer properly, and proving they do is
  // the job of test/routes/.
  it.each([
    ["GET", "/v1/threshold"],
    ["GET", "/v1/github/status"],
    ["GET", "/v1/commits"],
    ["GET", "/v1/installations/12345/api-key"],
  ])("registers %s %s", async (method, url) => {
    app = buildApp();
    await app.ready();

    const response = await app.inject({ method: method as "GET", url });

    expect(response.statusCode).not.toBe(404);
  });

  it("registers every route when every option is supplied", async () => {
    app = buildApp({
      webhook: { webhookSecret, onValidWebhook: vi.fn() },
      threshold: {},
      githubStatus: {},
      installationApiKey: {},
      commits: {},
    });
    await app.ready();

    for (const url of ["/healthz", "/v1/threshold", "/v1/github/status", "/v1/commits"]) {
      expect((await app.inject({ method: "GET", url })).statusCode, `GET ${url}`).not.toBe(404);
    }
    expect((await app.inject({ method: "POST", url: "/webhooks/github", payload: "{}" })).statusCode).not.toBe(404);
  });

  it("serves no route it was never asked to register", async () => {
    app = buildApp();
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/v1/not-a-real-route" });

    expect(response.statusCode).toBe(404);
  });
});
