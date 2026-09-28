import type { FastifyInstance, FastifySchema } from "fastify";
import { defaultExec, type CommandExecutor, LocalCommandExecutor, type ExecFn } from "../adapters/execFn.js";
import { resolveInstallationFromAuthHeader, type InstallationAuthPrismaClient } from "../auth/installationAuth.js";
import { prisma as defaultPrisma } from "../db/client.js";

import { access, constants as fsConstants } from "node:fs/promises";

export interface Pm2AppInfo {
  name: string;
  status: string;
  restarts: number;
  uptime: number;
  cwd?: string | undefined;
}

export interface VerificationCheckItem {
  id: "pm2_daemon" | "target_app" | "health_url" | "layout_paths" | "rollback_permission";
  title: string;
  passed: boolean;
  message: string;
}

export interface VerificationResponse {
  verified: boolean;
  checks: VerificationCheckItem[];
}

export interface VerifyRequestBody {
  owner: string;
  repo: string;
  target: {
    name: string;
    healthUrl?: string | undefined;
    startupGraceSeconds?: number | undefined;
    layout?: "releases" | "git" | undefined;
    cwd?: string | undefined;
    releasesDir?: string | undefined;
    currentSymlink?: string | undefined;
    sharedDirs?: string[] | undefined;
  };
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
  fsAccess?: (path: string, mode?: number) => Promise<void>;
  httpFetch?: (url: string, init?: any) => Promise<{ status: number; text: () => Promise<string> }>;
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

  const checkAccess = options.fsAccess ?? access;
  const doFetch = options.httpFetch ?? (fetch as any);

  app.post<{ Body: VerifyRequestBody }>("/v1/pm2/verify", async (request, reply) => {
    const installationId = await resolveInstallationFromAuthHeader(prismaClient, request.headers.authorization);
    if (!installationId) {
      return reply.code(401).send({ error: "missing or invalid Authorization: Bearer <installation API key> header" });
    }

    const body = request.body;
    if (!body || !body.owner || !body.repo || !body.target || !body.target.name) {
      return reply.code(400).send({ error: "Missing required fields: owner, repo, and target.name" });
    }

    const checks: VerificationCheckItem[] = [];

    // Check 1: PM2 daemon reachable
    let pm2List: RawPm2Process[] = [];
    try {
      const { stdout } = await executor.exec("pm2 jlist");
      pm2List = JSON.parse(stdout);
      checks.push({
        id: "pm2_daemon",
        title: "PM2 Daemon Reachability",
        passed: true,
        message: "PM2 daemon is reachable and responding",
      });
    } catch (err: any) {
      checks.push({
        id: "pm2_daemon",
        title: "PM2 Daemon Reachability",
        passed: false,
        message: `Failed to query PM2 daemon: ${err?.message || "Unknown error"}`,
      });
    }

    // Check 2: Target app in process table
    const targetName = body.target.name;
    const foundProc = pm2List.find((p) => p.name === targetName);
    if (foundProc) {
      checks.push({
        id: "target_app",
        title: "Target Process Table Entry",
        passed: true,
        message: `Target app '${targetName}' found with status '${foundProc.pm2_env?.status || "online"}'`,
      });
    } else {
      checks.push({
        id: "target_app",
        title: "Target Process Table Entry",
        passed: false,
        message: `Target app '${targetName}' not found in PM2 process table`,
      });
    }

    // Check 3: healthUrl responds with HTTP 2xx
    if (body.target.healthUrl) {
      try {
        const res = await doFetch(body.target.healthUrl);
        if (res.status >= 200 && res.status < 300) {
          checks.push({
            id: "health_url",
            title: "HTTP Health Probe",
            passed: true,
            message: `Health check responded with HTTP ${res.status} OK`,
          });
        } else {
          checks.push({
            id: "health_url",
            title: "HTTP Health Probe",
            passed: false,
            message: `Health check returned HTTP ${res.status} (expected 2xx)`,
          });
        }
      } catch (err: any) {
        checks.push({
          id: "health_url",
          title: "HTTP Health Probe",
          passed: false,
          message: `Health check request failed: ${err?.message || "Network error"}`,
        });
      }
    } else {
      checks.push({
        id: "health_url",
        title: "HTTP Health Probe",
        passed: false,
        message: "No healthUrl configured for verification",
      });
    }

    // Check 4: Release symlink and shared directories exist on host
    const layout = body.target.layout || "releases";
    const missingPaths: string[] = [];
    if (layout === "releases") {
      const releasesDir = body.target.releasesDir || (body.target.cwd ? `${body.target.cwd}/releases` : "/var/www/releases");
      const currentSymlink = body.target.currentSymlink || (body.target.cwd ? `${body.target.cwd}/current` : "/var/www/current");
      const sharedDirs = body.target.sharedDirs || [];

      try {
        await checkAccess(releasesDir);
      } catch {
        missingPaths.push(`releasesDir (${releasesDir})`);
      }

      try {
        await checkAccess(currentSymlink);
      } catch {
        missingPaths.push(`currentSymlink (${currentSymlink})`);
      }

      for (const shared of sharedDirs) {
        try {
          await checkAccess(shared);
        } catch {
          missingPaths.push(`sharedDir (${shared})`);
        }
      }
    } else {
      const cwd = body.target.cwd || ".";
      try {
        await checkAccess(cwd);
      } catch {
        missingPaths.push(`cwd (${cwd})`);
      }
    }

    if (missingPaths.length === 0) {
      checks.push({
        id: "layout_paths",
        title: "Deployment Layout Paths",
        passed: true,
        message: "Required filesystem layout paths exist on host",
      });
    } else {
      checks.push({
        id: "layout_paths",
        title: "Deployment Layout Paths",
        passed: false,
        message: `Missing required path(s) on host: ${missingPaths.join(", ")}`,
      });
    }

    // Check 5: Rollback permission check (dry-run without mutations)
    try {
      const pathToCheck = body.target.cwd || (body.target.layout === "releases" ? (body.target.releasesDir || "/var/www/releases") : ".");
      await checkAccess(pathToCheck, fsConstants.W_OK);
      await executor.exec(`pm2 describe ${targetName}`);
      checks.push({
        id: "rollback_permission",
        title: "Rollback Permission Check (Dry-Run)",
        passed: true,
        message: "Filesystem write and PM2 management permissions verified",
      });
    } catch (err: any) {
      checks.push({
        id: "rollback_permission",
        title: "Rollback Permission Check (Dry-Run)",
        passed: false,
        message: `Rollback permission check failed: ${err?.message || "Permission denied"}`,
      });
    }

    const verified = checks.every((c) => c.passed);

    // Save RepoConnection
    const repoConn = (prismaClient as any).repoConnection;
    if (repoConn && typeof repoConn.upsert === "function") {
      try {
        await repoConn.upsert({
          where: {
            installationId_owner_repo: {
              installationId: String(installationId),
              owner: body.owner,
              repo: body.repo,
            },
          },
          create: {
            installationId: String(installationId),
            owner: body.owner,
            repo: body.repo,
            verifiedAt: verified ? new Date() : null,
            verificationReport: checks,
            storedConfig: body.target,
          },
          update: {
            verifiedAt: verified ? new Date() : null,
            verificationReport: checks,
            storedConfig: body.target,
          },
        });
      } catch (dbErr) {
        request.log.warn({ dbErr }, "Failed to persist RepoConnection verification");
      }
    }

    return reply.code(200).send({ verified, checks });
  });
}
