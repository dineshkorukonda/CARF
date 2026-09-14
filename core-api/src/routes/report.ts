import type { FastifyInstance, FastifySchema } from "fastify";
import { prisma as defaultPrisma } from "../db/client.js";
import { resolveInstallationFromAuthHeader, type InstallationAuthPrismaClient } from "../auth/installationAuth.js";
import { incrementHealthReports, incrementRollbacksExecuted } from "./metrics.js";

export interface ReportRoutePrismaClient extends InstallationAuthPrismaClient {
  threshold: {
    findFirst(args: {
      where: { commit: { sha: string; installationId: string | null } };
      include?: { commit: true };
    }): Promise<{
      finalThreshold: number;
      finalWindow: number;
      commit: { id: string; sha: string; installationId: string | null };
    } | null>;
  };
  rolloutOutcome: {
    create(args: {
      data: {
        commitId: string;
        installationId: string | null;
        rolledBack: boolean;
        finalErrorRate: number;
        durationMs: number;
      };
    }): Promise<unknown>;
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
 * Automatically records a RolloutOutcome entry when a rollback is triggered or durationMs
 * is reported.
 */
export async function registerReportRoute(app: FastifyInstance, options: ReportRouteOptions = {}) {
  const prismaClient = options.prismaClient ?? (defaultPrisma as unknown as ReportRoutePrismaClient);

  app.post<{
    Body: { commit: string; errorRate: number; durationMs?: number };
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

    const thresholdRow = await prismaClient.threshold.findFirst({
      where: { commit: { sha: commitSha, installationId } },
      include: { commit: true },
    });

    if (!thresholdRow) {
      return reply.code(404).send({ error: "commit not found" });
    }

    const isBreached = errorRate >= thresholdRow.finalThreshold;
    const action = isBreached ? "rollback" : "continue";
    const reason = isBreached ? "threshold_violation" : "within_budget";

    incrementHealthReports(action);
    if (isBreached) {
      incrementRollbacksExecuted();
    }

    if (isBreached || durationMs !== undefined) {
      try {
        await prismaClient.rolloutOutcome.create({
          data: {
            commitId: thresholdRow.commit.id,
            installationId: thresholdRow.commit.installationId,
            rolledBack: isBreached,
            finalErrorRate: errorRate,
            durationMs: durationMs ?? 0,
          },
        });
      } catch (err) {
        request.log.error({ err }, "failed to record rollout outcome from /v1/report");
      }
    }

    return reply.code(200).send({
      action,
      reason,
      finalThreshold: thresholdRow.finalThreshold,
      currentErrorRate: errorRate,
      finalWindow: thresholdRow.finalWindow,
    });
  });
}
