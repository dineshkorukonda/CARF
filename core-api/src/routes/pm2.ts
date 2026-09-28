import type { FastifyInstance, FastifySchema } from "fastify";
import { defaultExec, type CommandExecutor, LocalCommandExecutor, type ExecFn } from "../adapters/execFn.js";
import { resolveInstallationFromAuthHeader, type InstallationAuthPrismaClient } from "../auth/installationAuth.js";
import { prisma as defaultPrisma } from "../db/client.js";

export interface Pm2AppInfo {
  name: string;
  status: string;
  restarts: number;
  uptime: number;
  cwd?: string;
}

interface RawPm2Env {
  status?: string;
  restart_time?: number;
  pm_uptime?: number;
  pm_cwd?: string;
}

interface RawPm2Process {
  name?: string;
  pm2_env?: RawPm2Env;
}

export interface Pm2RouteOptions {
  executor?: CommandExecutor | ExecFn;
  prismaClient?: InstallationAuthPrismaClient;
}

const responseSchema: FastifySchema = {
  response: {
    200: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "status", "restarts", "uptime"],
        properties: {
          name: { type: "string" },
          status: { type: "string" },
          restarts: { type: "integer" },
          uptime: { type: "integer" },
          cwd: { type: "string" },
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
    500: {
      type: "object",
      required: ["error"],
      properties: { error: { type: "string" } },
      additionalProperties: false,
    },
  },
};

/**
 * GET /v1/pm2/apps — returns read-only pm2 process summary (name, status, restarts, uptime, cwd).
 * Never returns environment variables or command-line arguments.
 * Requires Authorization: Bearer <installation API key>.
 */
export async function registerPm2Route(app: FastifyInstance, options: Pm2RouteOptions = {}) {
  let executor: CommandExecutor;
  if (options.executor) {
    if (typeof options.executor === "function") {
      executor = new LocalCommandExecutor(options.executor);
    } else {
      executor = options.executor;
    }
  } else {
    executor = new LocalCommandExecutor(defaultExec);
  }

  const prismaClient = options.prismaClient ?? (defaultPrisma as unknown as InstallationAuthPrismaClient);

  app.get("/v1/pm2/apps", { schema: responseSchema }, async (request, reply) => {
    const installationId = await resolveInstallationFromAuthHeader(prismaClient, request.headers.authorization);
    if (!installationId) {
      return reply.code(401).send({ error: "missing or invalid Authorization: Bearer <installation API key> header" });
    }

    try {
      const { stdout } = await executor.exec("pm2 jlist");
      let rawList: RawPm2Process[] = [];
      try {
        rawList = JSON.parse(stdout);
      } catch {
        return reply.code(200).send([]);
      }

      const now = Date.now();
      const sanitized: Pm2AppInfo[] = rawList
        .filter((proc) => typeof proc.name === "string" && proc.name.trim().length > 0)
        .map((proc) => {
          const pm2Env = proc.pm2_env || {};
          const status = pm2Env.status || "unknown";
          const restarts = typeof pm2Env.restart_time === "number" ? pm2Env.restart_time : 0;
          const uptimeMs = typeof pm2Env.pm_uptime === "number" && pm2Env.pm_uptime > 0 ? Math.max(0, now - pm2Env.pm_uptime) : 0;
          const uptime = Math.floor(uptimeMs / 1000);

          return {
            name: proc.name!,
            status,
            restarts,
            uptime,
            cwd: pm2Env.pm_cwd,
          };
        });

      return reply.code(200).send(sanitized);
    } catch (error) {
      request.log.error({ error }, "failed to execute pm2 jlist");
      return reply.code(500).send({ error: "Failed to query PM2 process list on host" });
    }
  });
}
