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
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    done(null, body);
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
