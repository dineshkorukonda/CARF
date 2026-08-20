import crypto from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { registerGithubWebhookRoute } from "../../src/routes/githubWebhook.js";

const secret = "test-secret";

const pushPayload = {
  before: "abc111",
  after: "def222",
  repository: { name: "CARF", owner: { login: "dineshkorukonda" } },
  installation: { id: 12345 },
};

function sign(body: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

describe("POST /webhooks/github", () => {
  let app: FastifyInstance;
  const onValidWebhook = vi.fn();

  beforeEach(async () => {
    onValidWebhook.mockReset();
    app = Fastify();
    await registerGithubWebhookRoute(app, { webhookSecret: secret, onValidWebhook });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects a request with a missing signature header", async () => {
    const body = JSON.stringify(pushPayload);
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: { "content-type": "application/json", "x-github-event": "push" },
      payload: body,
    });
    expect(response.statusCode).toBe(401);
    expect(onValidWebhook).not.toHaveBeenCalled();
  });

  it("rejects a request with an invalid signature", async () => {
    const body = JSON.stringify(pushPayload);
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "content-type": "application/json",
        "x-github-event": "push",
        "x-hub-signature-256": "sha256=deadbeef",
      },
      payload: body,
    });
    expect(response.statusCode).toBe(401);
    expect(onValidWebhook).not.toHaveBeenCalled();
  });

  it("accepts a validly signed push payload and extracts the deploy target", async () => {
    const body = JSON.stringify(pushPayload);
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
    expect(onValidWebhook).toHaveBeenCalledWith({
      owner: "dineshkorukonda",
      repo: "CARF",
      baseSha: "abc111",
      headSha: "def222",
      installationId: "12345",
    });
  });

  it("returns 200 without invoking onValidWebhook for a validly signed but unsupported event", async () => {
    const body = JSON.stringify({ action: "opened" });
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-hub-signature-256": sign(body),
      },
      payload: body,
    });
    expect(response.statusCode).toBe(200);
    expect(onValidWebhook).not.toHaveBeenCalled();
  });

  it("responds with an error instead of crashing when onValidWebhook throws", async () => {
    onValidWebhook.mockRejectedValueOnce(new Error("downstream failure"));
    const body = JSON.stringify(pushPayload);
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
    expect(response.statusCode).toBe(500);

    onValidWebhook.mockResolvedValueOnce(undefined);
    const followUp = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "content-type": "application/json",
        "x-github-event": "push",
        "x-hub-signature-256": sign(body),
      },
      payload: body,
    });
    expect(followUp.statusCode).toBe(202);
  });
});
