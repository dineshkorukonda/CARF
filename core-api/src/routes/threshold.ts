import type { FastifyInstance, FastifySchema } from "fastify";
import { prisma as defaultPrisma } from "../db/client.js";

/**
 * Minimal seam over the subset of PrismaClient's API this route needs. Mirrors the
 * PipelinePrismaClient convention in src/pipeline.ts: real PrismaClient satisfies this
 * structurally, tests inject an in-memory fake instead so route behavior can be unit
 * tested with Fastify's inject() without a live Postgres.
 */
export interface ThresholdRoutePrismaClient {
  threshold: {
    findFirst(args: {
      where: { commit: { sha: string } };
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
 * 200: { finalThreshold, finalWindow, activeTypes }
 * 400: missing `commit` query param
 * 404: no Threshold row exists for that commit SHA (commit not yet processed, or unknown)
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

      const thresholdRow = await prismaClient.threshold.findFirst({
        where: { commit: { sha: commitSha } },
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
