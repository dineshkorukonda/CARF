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
});
