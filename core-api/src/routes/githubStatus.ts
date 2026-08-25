import type { FastifyInstance, FastifySchema } from "fastify";
import { env } from "../config/env.js";
import { RealJwtSigner } from "../adapters/github/realJwtSigner.js";
import { RealAppInfoClient, type AppInfoClient } from "../adapters/github/appInfoClient.js";
import type { JwtSigner } from "../adapters/github/installationTokenClient.js";

export interface GithubStatusRouteOptions {
  /** App ID / private key seams; default to reading env vars lazily, per-request. */
  appId?: string;
  privateKey?: string;
  jwtSigner?: JwtSigner;
  appInfoClient?: AppInfoClient;
}

const responseSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      required: ["connected"],
      properties: {
        connected: { type: "boolean" },
        installationCount: { type: "number" },
        installations: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "account"],
            properties: { id: { type: "number" }, account: { type: "string" } },
          },
        },
        error: { type: "string" },
      },
      additionalProperties: false,
    },
  },
};

function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return String(err);
}

/**
 * GET /v1/github/status — diagnostic endpoint: signs an App JWT from the configured App
 * ID/private key and calls GitHub's GET /app/installations with it. This validates the
 * App's credentials *and* surfaces where it's installed, independent of any one target
 * repo (unlike an installation access token, which requires already knowing an
 * installation ID).
 *
 * Always 200 — failures (missing env vars, GitHub rejecting the JWT, network errors) are
 * reported as `{ connected: false, error }` in the body rather than an HTTP error status,
 * since the endpoint's job is to report connectivity state, not to succeed or fail itself.
 */
export async function registerGithubStatusRoute(app: FastifyInstance, options: GithubStatusRouteOptions = {}) {
  const jwtSigner = options.jwtSigner ?? new RealJwtSigner();
  const appInfoClient = options.appInfoClient ?? new RealAppInfoClient();

  app.get("/v1/github/status", { schema: responseSchema }, async (_request, reply) => {
    // Public, unauthenticated, cross-origin by design: any adopter's own frontend needs to
    // call their own core-api instance's status from a different origin (e.g. the CARF
    // web app checking a URL the visitor pasted in). No other route gets this treatment.
    reply.header("Access-Control-Allow-Origin", "*");

    try {
      const appId = options.appId ?? env.githubAppId();
      const privateKey = options.privateKey ?? env.githubAppPrivateKey();

      const appJwt = jwtSigner.sign(appId, privateKey);
      const installations = await appInfoClient.listInstallations(appJwt);

      return reply.code(200).send({
        connected: true,
        installationCount: installations.length,
        installations,
      });
    } catch (err) {
      return reply.code(200).send({ connected: false, error: errorMessage(err) });
    }
  });
}
