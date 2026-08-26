import type { FastifyInstance, FastifySchema } from "fastify";
import { prisma as defaultPrisma } from "../db/client.js";
import { resolveInstallationFromAuthHeader, type InstallationAuthPrismaClient } from "../auth/installationAuth.js";

/**
 * Minimal seam over the subset of PrismaClient's API this route needs. Mirrors the
 * PipelinePrismaClient convention in src/pipeline.ts: real PrismaClient satisfies this
 * structurally, tests inject an in-memory fake instead so route behavior can be unit
 * tested with Fastify's inject() without a live Postgres.
 */
export interface ThresholdRoutePrismaClient extends InstallationAuthPrismaClient {
  threshold: {
    findFirst(args: {
      where: { commit: { sha: string; installationId: string | null } };
    }): Promise<{ finalThreshold: number; finalWindow: number; activeTypes: string[] } | null>;
  };
}

export interface ThresholdRouteOptions {
  /** Injected Prisma client seam; defaults to the app-wide singleton (src/db/client.ts). */
  prismaClient?: ThresholdRoutePrismaClient;
}

const responseSchema: FastifySchema = {
  querystring: {
    type: "object",
    properties: {
      commit: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["finalThreshold", "finalWindow", "activeTypes"],
      properties: {
        finalThreshold: { type: "number" },
        finalWindow: { type: "number" },
        activeTypes: { type: "array", items: { type: "string" } },
      },
      additionalProperties: false,
    },
    400: {
      type: "object",
      required: ["error"],
      properties: { error: { type: "string" } },
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
  },
};

/**
 * GET /v1/threshold?commit=<sha> — Augment mode webhook API (#12). Deployment tooling
 * (Argo Rollouts AnalysisTemplate webhook metric providers, Flagger webhook metrics —
 * see examples/) polls this endpoint during a rollout to fetch the anomaly threshold and
 * evaluation window computed for a given commit by the threshold engine
 * (src/threshold/engine.ts), persisted via src/pipeline.ts's processCommit().
 *
 * Auth (issue #65's decided mechanism -- see src/auth/): an optional `Authorization:
 * Bearer <installation API key>` header. A commit SHA alone isn't secret (visible in any
 * git log/PR/CI output), so once a commit carries a real `installationId` (i.e. it came
 * through the GitHub App, not a manual/local call), a caller must present that
 * installation's own key to read it -- guessing another tenant's SHA gets a 404, same as
 * an unknown one. Commits with no `installationId` at all (self-hosted/local/dev setups
 * that never wired up multi-tenancy) remain readable without a key, preserving today's
 * behavior for that case -- there's no tenant to leak across.
 *
 * 200: { finalThreshold, finalWindow, activeTypes }
 * 400: missing `commit` query param
 * 401: an Authorization header was present but its key isn't recognized
 * 404: no Threshold row exists for that commit SHA visible to this caller (not yet
 *   processed, unknown, or -- indistinguishably -- belongs to a different installation)
 */
export async function registerThresholdRoute(app: FastifyInstance, options: ThresholdRouteOptions = {}) {
  const prismaClient = options.prismaClient ?? (defaultPrisma as unknown as ThresholdRoutePrismaClient);

  app.get<{ Querystring: { commit?: string } }>(
    "/v1/threshold",
    { schema: responseSchema },
    async (request, reply) => {
      const commitSha = request.query.commit;

      if (!commitSha) {
        return reply.code(400).send({ error: "missing commit query param" });
      }

      const authHeader = request.headers.authorization;
      let installationId: string | null = null;
      if (authHeader) {
        installationId = await resolveInstallationFromAuthHeader(prismaClient, authHeader);
        if (installationId === null) {
          return reply.code(401).send({ error: "invalid or unrecognized API key" });
        }
      }

      const thresholdRow = await prismaClient.threshold.findFirst({
        where: { commit: { sha: commitSha, installationId } },
      });

      if (!thresholdRow) {
        return reply.code(404).send({ error: "commit not found" });
      }

      return reply.code(200).send({
        finalThreshold: thresholdRow.finalThreshold,
        finalWindow: thresholdRow.finalWindow,
        activeTypes: thresholdRow.activeTypes,
      });
    }
  );
}
