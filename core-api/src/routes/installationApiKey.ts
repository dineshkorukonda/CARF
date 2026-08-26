import type { FastifyInstance, FastifySchema } from "fastify";
import { prisma as defaultPrisma } from "../db/client.js";
import { RealAppInfoClient, type AppInfoClient } from "../adapters/github/appInfoClient.js";
import type { HttpError } from "../adapters/github/githubApiClient.js";
import { rotateApiKeyForInstallation, type InstallationApiKeyPrismaClient } from "../auth/installationApiKeyService.js";

export interface InstallationApiKeyRouteOptions {
  /** Injected AppInfoClient seam; defaults to the real GitHub API. */
  appInfoClient?: AppInfoClient;
  /** Injected Prisma client seam; defaults to the app-wide singleton (src/db/client.ts). */
  prismaClient?: InstallationApiKeyPrismaClient;
}

const responseSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      required: ["apiKey"],
      properties: { apiKey: { type: "string" } },
      additionalProperties: false,
    },
    401: {
      type: "object",
      required: ["error"],
      properties: { error: { type: "string" } },
      additionalProperties: false,
    },
    404: {
      type: "object",
      required: ["error"],
      properties: { error: { type: "string" } },
      additionalProperties: false,
    },
    502: {
      type: "object",
      required: ["error"],
      properties: { error: { type: "string" } },
      additionalProperties: false,
    },
  },
};

const BEARER_PREFIX = "Bearer ";

function isHttpError(err: unknown): err is HttpError {
  return typeof err === "object" && err !== null && "status" in err && typeof (err as { status: unknown }).status === "number";
}

/**
 * GET /v1/installations/:installationId/api-key — issue #64's key-retrieval endpoint.
 * Bootstraps around the fact that an `InstallationApiKey` only ever stores a hash: since
 * the plaintext can't be recovered once issued (see #65), a caller who needs it again
 * (the dashboard, populating its own store the first time it configures an installation)
 * has to prove they're allowed to have a *new* one instead.
 *
 * Auth: `Authorization: Bearer <GitHub App JWT>` -- not an installation access token, and
 * not this endpoint's own output. The dashboard holds the same App private key core-api
 * does (see dashboard/.env.example), so it can sign one itself. core-api doesn't verify
 * the JWT's signature locally -- it hands it straight to GitHub's own
 * `GET /app/installations` and trusts GitHub's 200/401/403 as the verdict. If GitHub
 * accepts the JWT and the requested `installationId` appears in the returned list, the
 * caller has proven App-level control (installation ids are globally unique across every
 * GitHub App, so a match here can't be a different App's installation colliding by
 * coincidence).
 *
 * Rotates rather than reads: a fresh key is minted on every successful call
 * (`rotateApiKeyForInstallation`), invalidating whatever key existed before. See that
 * function's doc comment for why that's the only option, and why it's safe here.
 */
export async function registerInstallationApiKeyRoute(
  app: FastifyInstance,
  options: InstallationApiKeyRouteOptions = {}
) {
  const appInfoClient = options.appInfoClient ?? new RealAppInfoClient();
  const prismaClient = options.prismaClient ?? (defaultPrisma as unknown as InstallationApiKeyPrismaClient);

  app.get<{ Params: { installationId: string } }>(
    "/v1/installations/:installationId/api-key",
    { schema: responseSchema },
    async (request, reply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith(BEARER_PREFIX)) {
        return reply.code(401).send({ error: "missing Authorization: Bearer <GitHub App JWT> header" });
      }
      const appJwt = authHeader.slice(BEARER_PREFIX.length).trim();

      let installations;
      try {
        installations = await appInfoClient.listInstallations(appJwt);
      } catch (error) {
        if (isHttpError(error) && (error.status === 401 || error.status === 403)) {
          return reply.code(401).send({ error: "GitHub rejected the provided App JWT" });
        }
        return reply.code(502).send({ error: "failed to verify the installation with GitHub" });
      }

      const { installationId } = request.params;
      const controlsInstallation = installations.some((installation) => String(installation.id) === installationId);
      if (!controlsInstallation) {
        return reply.code(404).send({ error: "installation not found for this App" });
      }

      const { plaintextKey } = await rotateApiKeyForInstallation(prismaClient, installationId);
      return reply.code(200).send({ apiKey: plaintextKey });
    }
  );
}
