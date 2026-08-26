import type { FastifyInstance, FastifySchema } from "fastify";
import { prisma as defaultPrisma } from "../db/client.js";
import { resolveInstallationFromAuthHeader, type InstallationAuthPrismaClient } from "../auth/installationAuth.js";

const RECENT_COMMITS_LIMIT = 20;

interface CommitRow {
  sha: string;
  owner: string;
  repo: string;
  createdAt: Date;
  threshold: { finalThreshold: number; finalWindow: number; activeTypes: string[] } | null;
  rolloutOutcomes: Array<{ rolledBack: boolean; finalErrorRate: number }>;
}

export interface CommitsRoutePrismaClient extends InstallationAuthPrismaClient {
  commit: {
    findMany(args: {
      where: { installationId: string };
      orderBy: { createdAt: "desc" };
      take: number;
      include: { threshold: true; rolloutOutcomes: { orderBy: { createdAt: "desc" }; take: 1 } };
    }): Promise<CommitRow[]>;
  };
}

export interface CommitsRouteOptions {
  /** Injected Prisma client seam; defaults to the app-wide singleton (src/db/client.ts). */
  prismaClient?: CommitsRoutePrismaClient;
}

const responseSchema: FastifySchema = {
  response: {
    200: {
      type: "array",
      items: {
        type: "object",
        required: ["sha", "owner", "repo", "createdAt", "finalThreshold", "finalWindow", "activeTypes", "rolledBack", "finalErrorRate"],
        properties: {
          sha: { type: "string" },
          owner: { type: "string" },
          repo: { type: "string" },
          createdAt: { type: "string" },
          finalThreshold: { type: ["number", "null"] },
          finalWindow: { type: ["number", "null"] },
          activeTypes: { type: "array", items: { type: "string" } },
          rolledBack: { type: ["boolean", "null"] },
          finalErrorRate: { type: ["number", "null"] },
        },
        additionalProperties: false,
      },
    },
    401: {
      type: "object",
      required: ["error"],
      properties: { error: { type: "string" } },
      additionalProperties: false,
    },
  },
};

/**
 * GET /v1/commits — issue #64's list endpoint: recent classified commits and their
 * computed thresholds (plus rollout outcome, if a Standalone loop ran) for the caller's
 * own installation. Always requires `Authorization: Bearer <installation API key>` --
 * unlike GET /v1/threshold's dual-mode (a single known SHA has a legitimate unauthenticated
 * use case: an in-cluster Augment pipeline that already knows what it's asking for), a
 * *list* of everything an installation has done has no equivalent unauthenticated caller,
 * so there's no backward-compatibility case to preserve here.
 */
export async function registerCommitsRoute(app: FastifyInstance, options: CommitsRouteOptions = {}) {
  const prismaClient = options.prismaClient ?? (defaultPrisma as unknown as CommitsRoutePrismaClient);

  app.get("/v1/commits", { schema: responseSchema }, async (request, reply) => {
    const installationId = await resolveInstallationFromAuthHeader(prismaClient, request.headers.authorization);
    if (!installationId) {
      return reply.code(401).send({ error: "missing or invalid Authorization: Bearer <installation API key> header" });
    }

    const commits = await prismaClient.commit.findMany({
      where: { installationId },
      orderBy: { createdAt: "desc" },
      take: RECENT_COMMITS_LIMIT,
      include: { threshold: true, rolloutOutcomes: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    return reply.code(200).send(
      commits.map((commit) => ({
        sha: commit.sha,
        owner: commit.owner,
        repo: commit.repo,
        createdAt: commit.createdAt.toISOString(),
        finalThreshold: commit.threshold?.finalThreshold ?? null,
        finalWindow: commit.threshold?.finalWindow ?? null,
        activeTypes: commit.threshold?.activeTypes ?? [],
        rolledBack: commit.rolloutOutcomes[0]?.rolledBack ?? null,
        finalErrorRate: commit.rolloutOutcomes[0]?.finalErrorRate ?? null,
      }))
    );
  });
}
