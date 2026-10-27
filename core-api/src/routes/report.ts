import type { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifySchema } from "fastify";
import { prisma as defaultPrisma } from "../db/client.js";
import { resolveInstallationFromAuthHeader, type InstallationAuthPrismaClient } from "../auth/installationAuth.js";
import { incrementHealthReports } from "./metrics.js";

export interface ReportRoutePrismaClient extends InstallationAuthPrismaClient {
  threshold: {
    findMany(args: {
      where: { commit: { sha: string; installationId: string | null; owner?: string; repo?: string } };
      include: { commit: true }; take: number;
    }): Promise<Array<{
      finalThreshold: number; finalWindow: number;
      commit: { id: string; sha: string; installationId: string | null };
    }>>;
  };
  healthReport: {
    create(args: { data: Prisma.HealthReportUncheckedCreateInput }): Promise<unknown>;
  };
}

export interface ReportRouteOptions {
  /** Injected Prisma client seam; defaults to the app-wide singleton (src/db/client.ts). */
  prismaClient?: ReportRoutePrismaClient;
}

const reportBodySchema = {
  type: "object",
  required: ["commit", "errorRate"],
  properties: {
    commit: { type: "string" },
    errorRate: { type: "number", minimum: 0 },
    owner: { type: "string", minLength: 1 },
    repo: { type: "string", minLength: 1 },
    durationMs: { type: "number", minimum: 0 },
  },
  additionalProperties: false,
};

const responseSchema: FastifySchema = {
  body: reportBodySchema,
  response: {
    200: {
      type: "object",
      required: ["action", "reason", "finalThreshold", "currentErrorRate", "finalWindow"],
      properties: {
        action: { type: "string", enum: ["continue", "rollback"] },
        reason: { type: "string" },
        finalThreshold: { type: "number" },
        currentErrorRate: { type: "number" },
        finalWindow: { type: "number" },
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
 * POST /v1/report — accepts a live health reading for an in-flight rollout, evaluates
 * it against the commit's computed dynamic threshold, and returns an actionable verdict:
 * `{ action: "continue" | "rollback", reason: "within_budget" | "threshold_violation", ... }`.
 *
 * Persists health readings and verdicts separately from deployment outcomes.
 * External deployers remain responsible for executing rollback decisions.
 */
export async function registerReportRoute(app: FastifyInstance, options: ReportRouteOptions = {}) {
  const prismaClient: ReportRoutePrismaClient = options.prismaClient ?? defaultPrisma;

  app.post<{
    Body: { commit: string; errorRate: number; durationMs?: number; owner?: string; repo?: string };
  }>("/v1/report", { schema: responseSchema }, async (request, reply) => {
    const { commit: commitSha, errorRate, durationMs } = request.body;

    const authHeader = request.headers.authorization;
    let installationId: string | null = null;
    if (authHeader) {
      installationId = await resolveInstallationFromAuthHeader(prismaClient, authHeader);
      if (installationId === null) {
        return reply.code(401).send({ error: "invalid or unrecognized API key" });
      }
    }

    const thresholdRows = await prismaClient.threshold.findMany({
      where: { commit: { sha: commitSha, installationId,
        ...(request.body.owner ? { owner: request.body.owner } : {}),
        ...(request.body.repo ? { repo: request.body.repo } : {}),
      } },
      include: { commit: true }, take: 2,
    });

    const thresholdRow = thresholdRows[0];
    if (!thresholdRow) {
      return reply.code(404).send({ error: "commit not found" });
    }

    if (thresholdRows.length > 1) return reply.code(409).send({ error: "Commit exists in multiple repositories; supply owner and repo" });

    const isBreached = errorRate >= thresholdRow.finalThreshold;
    const action = isBreached ? "rollback" : "continue";
    const reason = isBreached ? "threshold_violation" : "within_budget";

    try {
      await prismaClient.healthReport.create({ data: {
        commitId: thresholdRow.commit.id, installationId: thresholdRow.commit.installationId,
        errorRate, action, threshold: thresholdRow.finalThreshold, window: thresholdRow.finalWindow,
        ...(durationMs !== undefined ? { durationMs } : {}),
      } });
    } catch (err) {
      request.log.error({ err }, "failed to persist health report");
      return reply.code(503).send({ error: "Unable to persist health report; retry the report" });
    }
    incrementHealthReports(action);

    return reply.code(200).send({
      action,
      reason,
      finalThreshold: thresholdRow.finalThreshold,
      currentErrorRate: errorRate,
      finalWindow: thresholdRow.finalWindow,
    });
  });
}
