import type { FastifyInstance, FastifySchema } from "fastify";
import { resolveInstallationFromAuthHeader, type InstallationAuthPrismaClient } from "../auth/installationAuth.js";
import { prisma as defaultPrisma } from "../db/client.js";
import type { RollbackAdapter } from "../adapters/rollbackAdapter.js";
import { PM2Adapter } from "../adapters/pm2.js";
import { loadCarfConfig } from "../config/carfConfig.js";
import { dispatchRollbackAlert } from "../alerts/dispatch.js";

export interface RolloutRollbackPrismaClient extends InstallationAuthPrismaClient {
  rolloutOutcome: {
    findUnique(args: {
      where: { id: string };
      include?: { commit?: { select: { baseSha: boolean; changeVector?: boolean } }; samples?: boolean };
    }): Promise<{
      id: string;
      owner: string | null;
      repo: string | null;
      commitSha: string;
      installationId: string | null;
      status: string;
      threshold: number;
      window: number;
      commit?: { baseSha: string; changeVector?: { data?: number } | null } | null;
    } | null>;
    update(args: {
      where: { id: string };
      data: {
        status: "ROLLED_BACK";
        trigger?: "manual" | "auto";
        rolledBack: boolean;
        reason: string;
        rollbackVerified?: boolean | null;
        finishedAt: Date;
      };
    }): Promise<unknown>;
  };
  repoConnection?: {
    findUnique(args: {
      where: { installationId_owner_repo: { installationId: string; owner: string; repo: string } };
    }): Promise<{
      id: string;
      verifiedAt: Date | null;
      monitoringPaused: boolean;
      storedConfig: unknown;
    } | null>;
  };
  rolloutAuditLog?: {
    create(args: {
      data: {
        actor: string;
        owner: string;
        repo: string;
        rolloutId?: string;
        action: string;
        result: string;
        details?: unknown;
        ts?: Date;
      };
    }): Promise<unknown>;
  };
  rolloutSample?: {
    findMany(args: {
      where: { rolloutId: string };
      orderBy: { ts: "asc" };
    }): Promise<Array<{ id: string; rolloutId: string; ts: Date; errorRate: number; perTarget?: unknown }>>;
  };
}

export interface RolloutRollbackRouteOptions {
  prismaClient?: RolloutRollbackPrismaClient;
  adapterFactory?: (previousSha: string, targetName?: string) => RollbackAdapter;
}

const rollbackSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["success", "rolloutId", "status"],
      properties: {
        success: { type: "boolean" },
        rolloutId: { type: "string" },
        status: { type: "string" },
        message: { type: "string" },
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
    403: {
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

const samplesSchema: FastifySchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["rolloutId", "samples"],
      properties: {
        rolloutId: { type: "string" },
        samples: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "ts", "errorRate"],
            properties: {
              id: { type: "string" },
              ts: { type: "string" },
              errorRate: { type: "number" },
              perTarget: { type: ["object", "null"] },
            },
          },
        },
      },
    },
    401: {
      type: "object",
      required: ["error"],
      properties: { error: { type: "string" } },
    },
    404: {
      type: "object",
      required: ["error"],
      properties: { error: { type: "string" } },
    },
  },
};

export async function registerRolloutRollbackRoute(
  app: FastifyInstance,
  options: RolloutRollbackRouteOptions = {}
) {
  const prismaClient = options.prismaClient ?? (defaultPrisma as unknown as RolloutRollbackPrismaClient);

  // POST /v1/rollouts/:id/rollback — manual rollback triggered from UI
  app.post<{ Params: { id: string }; Body: { actor?: string } }>(
    "/v1/rollouts/:id/rollback",
    { schema: rollbackSchema },
    async (request, reply) => {
      const installationId = await resolveInstallationFromAuthHeader(prismaClient, request.headers.authorization);
      if (!installationId) {
        return reply.code(401).send({ error: "missing or invalid Authorization: Bearer <installation API key> header" });
      }

      const { id } = request.params;
      const rollout = await prismaClient.rolloutOutcome.findUnique({
        where: { id },
        include: { commit: { select: { baseSha: true, changeVector: true } } },
      });

      if (!rollout || rollout.installationId !== installationId) {
        return reply.code(404).send({ error: "Rollout outcome not found for this installation" });
      }

      const owner = rollout.owner ?? "";
      const repo = rollout.repo ?? "";
      const actor = request.body?.actor || "session_user";

      // Verify repository connection has been verified
      if (prismaClient.repoConnection?.findUnique) {
        const repoConn = await prismaClient.repoConnection.findUnique({
          where: { installationId_owner_repo: { installationId, owner, repo } },
        });
        if (repoConn && !repoConn.verifiedAt) {
          return reply.code(403).send({ error: "Cannot trigger rollback: repository connection is not verified" });
        }
      }

      const previousSha = rollout.commit?.baseSha;
      if (!previousSha || previousSha === "0000000000000000000000000000000000000000") {
        return reply.code(400).send({ error: "Cannot rollback: no valid previous commit SHA available" });
      }

      const carfConfig = loadCarfConfig();
      const firstTarget = carfConfig?.adapter?.targets?.[0];
      const targetName =
        carfConfig?.adapter?.target ??
        (typeof firstTarget === "string" ? firstTarget : firstTarget?.name) ??
        "";

      const defaultFactory = (sha: string) =>
        new PM2Adapter(sha, {
          releasesRoot: carfConfig?.adapter?.releasesRoot,
          currentSymlink: carfConfig?.adapter?.currentSymlink,
          cwd: carfConfig?.adapter?.cwd,
          buildCommand: carfConfig?.adapter?.buildCommand,
          layout: carfConfig?.adapter?.layout,
          healthUrl: carfConfig?.adapter?.healthUrl,
          startupGraceSeconds: carfConfig?.adapter?.startupGraceSeconds,
          sharedPaths: carfConfig?.adapter?.sharedPaths,
          probeCount: carfConfig?.adapter?.probeCount,
        });

      const buildAdapter = options.adapterFactory ?? defaultFactory;
      const adapter = buildAdapter(previousSha, targetName);

      try {
        let rollbackVerified: boolean | undefined = undefined;
        if (typeof adapter.rollbackWithVerification === "function") {
          const res = await adapter.rollbackWithVerification(targetName, carfConfig?.adapter?.startupGraceSeconds ?? 60);
          rollbackVerified = res.rollbackVerified;
        } else {
          await adapter.rollback(targetName);
        }

        const hasSchemaChange = Boolean(
          rollout.commit?.changeVector &&
          typeof rollout.commit.changeVector.data === "number" &&
          rollout.commit.changeVector.data > 0
        );
        let reason = `manual: triggered by ${actor}`;
        if (hasSchemaChange) {
          reason = `${reason}; schema not reverted`;
        }

        const now = new Date();
        await prismaClient.rolloutOutcome.update({
          where: { id: rollout.id },
          data: {
            status: "ROLLED_BACK",
            trigger: "manual",
            rolledBack: true,
            reason,
            rollbackVerified: rollbackVerified ?? null,
            finishedAt: now,
          },
        });

        if (prismaClient.rolloutAuditLog?.create) {
          await prismaClient.rolloutAuditLog.create({
            data: {
              actor,
              owner,
              repo,
              rolloutId: rollout.id,
              action: "manual_rollback",
              result: "success",
              details: { previousSha, rollbackVerified },
              ts: now,
            },
          });
        }

        try {
          await dispatchRollbackAlert(process.env.CARF_ALERT_WEBHOOK_URL, {
            owner,
            repo,
            commitSha: rollout.commitSha,
            reason,
            rollbackVerified,
          });
        } catch (alertError) {
          request.log.error({ err: alertError, id: rollout.id }, "rollback alert dispatch failed");
        }

        return reply.code(200).send({
          success: true,
          rolloutId: rollout.id,
          status: "ROLLED_BACK",
          message: `Manual rollback to ${previousSha} executed successfully`,
        });
      } catch (err) {
        request.log.error({ err, id: rollout.id }, "manual rollback execution failed");

        if (prismaClient.rolloutAuditLog?.create) {
          await prismaClient.rolloutAuditLog.create({
            data: {
              actor,
              owner,
              repo,
              rolloutId: rollout.id,
              action: "manual_rollback",
              result: "failed",
              details: { error: (err as Error).message },
              ts: new Date(),
            },
          });
        }

        return reply.code(500).send({ error: `Rollback command failed: ${(err as Error).message}` });
      }
    }
  );

  // GET /v1/rollouts/:id/samples — returns telemetry samples for a rollout
  app.get<{ Params: { id: string } }>(
    "/v1/rollouts/:id/samples",
    { schema: samplesSchema },
    async (request, reply) => {
      const installationId = await resolveInstallationFromAuthHeader(prismaClient, request.headers.authorization);
      if (!installationId) {
        return reply.code(401).send({ error: "missing or invalid Authorization: Bearer <installation API key> header" });
      }

      const { id } = request.params;
      const rollout = await prismaClient.rolloutOutcome.findUnique({
        where: { id },
      });

      if (!rollout || rollout.installationId !== installationId) {
        return reply.code(404).send({ error: "Rollout outcome not found for this installation" });
      }

      const samples = prismaClient.rolloutSample?.findMany
        ? await prismaClient.rolloutSample.findMany({
            where: { rolloutId: id },
            orderBy: { ts: "asc" },
          })
        : [];

      return reply.code(200).send({
        rolloutId: id,
        samples: samples.map((s) => ({
          id: s.id,
          ts: s.ts.toISOString(),
          errorRate: s.errorRate,
          perTarget: (s.perTarget as Record<string, unknown>) ?? null,
        })),
      });
    }
  );
}
