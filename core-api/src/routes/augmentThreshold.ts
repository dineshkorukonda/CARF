import type { FastifyInstance, FastifySchema } from "fastify";
import {
  computeAugmentRecommendation,
  type AugmentThresholdResponse,
} from "../augment/computeRecommendation.js";
import { resolveInstallationFromAuthHeader, type InstallationAuthPrismaClient } from "../auth/installationAuth.js";
import type { CodeFile } from "../classifier/codeComplexityScorer.js";
import { prisma as defaultPrisma } from "../db/client.js";

interface PersistedVector {
  infra: number;
  dependency: number;
  config: number;
  code: number;
  data: number;
  codeComplexity: number;
}

interface PersistedThreshold {
  finalThreshold: number;
  finalWindow: number;
}

export interface AugmentThresholdPrismaClient extends InstallationAuthPrismaClient {
  commit: {
    findFirst(args: {
      where: { owner: string; repo: string; sha: string; installationId: string | null };
      include: { threshold: true; changeVector: true };
    }): Promise<{
      threshold: PersistedThreshold | null;
      changeVector: PersistedVector | null;
    } | null>;
  };
}

export interface AugmentThresholdRouteOptions {
  prismaClient?: AugmentThresholdPrismaClient;
  /**
   * Optional on-demand classify path when the SHA is not yet persisted.
   * Production can wire GitHub diff acquisition here; tests inject fixtures.
   */
  loadChangedFiles?: (args: {
    owner: string;
    repo: string;
    sha: string;
    installationId: string | null;
  }) => Promise<CodeFile[] | null>;
}

const responseSchema: FastifySchema = {
  querystring: {
    type: "object",
    properties: {
      owner: { type: "string" },
      repo: { type: "string" },
      sha: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["threshold", "window", "changeVector"],
      properties: {
        threshold: { type: "number" },
        window: { type: "number" },
        changeVector: {
          type: "object",
          required: ["infra", "dependency", "config", "code", "data", "code_complexity"],
          properties: {
            infra: { type: "number" },
            dependency: { type: "number" },
            config: { type: "number" },
            code: { type: "number" },
            data: { type: "number" },
            code_complexity: { type: "number" },
          },
          additionalProperties: false,
        },
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

function toResponse(threshold: PersistedThreshold, vector: PersistedVector): AugmentThresholdResponse {
  return {
    threshold: threshold.finalThreshold,
    window: threshold.finalWindow,
    changeVector: {
      infra: vector.infra,
      dependency: vector.dependency,
      config: vector.config,
      code: vector.code,
      data: vector.data,
      code_complexity: vector.codeComplexity,
    },
  };
}

/**
 * GET /v1/augment/threshold?owner=&repo=&sha= — augment-mode read-only recommendation (#143).
 * Returns the same classifier + threshold result standalone mode persists, without executing rollback.
 */
export async function registerAugmentThresholdRoute(
  app: FastifyInstance,
  options: AugmentThresholdRouteOptions = {}
) {
  const prismaClient = options.prismaClient ?? (defaultPrisma as unknown as AugmentThresholdPrismaClient);

  app.get<{ Querystring: { owner?: string; repo?: string; sha?: string } }>(
    "/v1/augment/threshold",
    { schema: responseSchema },
    async (request, reply) => {
      const owner = request.query.owner?.trim() ?? "";
      const repo = request.query.repo?.trim() ?? "";
      const sha = request.query.sha?.trim() ?? "";
      if (!owner || !repo || !sha) {
        return reply.code(400).send({ error: "missing owner, repo, or sha query param" });
      }

      const authHeader = request.headers.authorization;
      let installationId: string | null = null;
      if (authHeader) {
        installationId = await resolveInstallationFromAuthHeader(prismaClient, authHeader);
        if (installationId === null) {
          return reply.code(401).send({ error: "invalid or unrecognized API key" });
        }
      }

      const commit = await prismaClient.commit.findFirst({
        where: { owner, repo, sha, installationId },
        include: { threshold: true, changeVector: true },
      });

      if (commit?.threshold && commit.changeVector) {
        return reply.code(200).send(toResponse(commit.threshold, commit.changeVector));
      }

      if (options.loadChangedFiles) {
        const files = await options.loadChangedFiles({ owner, repo, sha, installationId });
        if (files && files.length > 0) {
          const computed = computeAugmentRecommendation(files);
          if (computed) {
            return reply.code(200).send(computed);
          }
        }
      }

      return reply.code(404).send({ error: "commit not found" });
    }
  );
}
