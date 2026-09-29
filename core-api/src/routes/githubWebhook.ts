import type { FastifyInstance } from "fastify";
import { verifyGithubSignature } from "../adapters/github/webhookSignature.js";
import { parseWebhookPayload, type DeployTarget } from "../adapters/github/webhookPayload.js";

export interface GithubWebhookRouteOptions {
  webhookSecret: string;
  onValidWebhook: (target: DeployTarget) => void | Promise<void>;
}

/**
 * POST /webhooks/github — verifies X-Hub-Signature-256 against the raw body, parses
 * push/pull_request payloads, and invokes onValidWebhook with the extracted deploy
 * target. Diff acquisition + classification are triggered by the caller, not here.
 */
export async function registerGithubWebhookRoute(app: FastifyInstance, options: GithubWebhookRouteOptions) {
  // HMAC verification needs the raw JSON string. Fastify only allows one
  // application/json parser, so keep the webhook path as a string and parse
  // every other JSON route (e.g. POST /v1/pm2/verify) back into an object.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    const raw = typeof body === "string" ? body : Buffer.isBuffer(body) ? body.toString("utf8") : String(body ?? "");
    const path = (req.url ?? "").split("?")[0];
    if (path === "/webhooks/github") {
      done(null, raw);
      return;
    }
    try {
      done(null, raw.length === 0 ? {} : JSON.parse(raw));
    } catch (err) {
      const error = err instanceof Error ? err : new Error("invalid JSON");
      (error as { statusCode?: number }).statusCode = 400;
      done(error, undefined);
    }
  });

  app.post("/webhooks/github", async (request, reply) => {
    const rawBody = request.body as string;
    const signature = request.headers["x-hub-signature-256"] as string | undefined;

    if (!verifyGithubSignature(rawBody, signature, options.webhookSecret)) {
      return reply.code(401).send({ error: "invalid signature" });
    }

    const eventName = request.headers["x-github-event"] as string | undefined;
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const target = parseWebhookPayload(eventName ?? "", payload);

    if (!target) {
      return reply.code(200).send({ status: "ignored" });
    }

    await options.onValidWebhook(target);
    return reply.code(202).send({ status: "accepted" });
  });
}
