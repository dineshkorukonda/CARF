import path from "node:path";
import { access, constants as fsConstants, lstat } from "node:fs/promises";
import type { FastifyInstance, FastifySchema } from "fastify";
import { defaultExec, type CommandExecutor, LocalCommandExecutor, type ExecFn } from "../adapters/execFn.js";
import { PM2Adapter } from "../adapters/pm2.js";
import { findPm2Process } from "../adapters/pm2Process.js";
import { resolveInstallationFromAuthHeader, type InstallationAuthPrismaClient } from "../auth/installationAuth.js";
import { prisma as defaultPrisma } from "../db/client.js";

export interface Pm2AppInfo {
  name: string;
  status: string;
  restarts: number;
  uptime: number;
  cwd?: string | undefined;
  pid?: number | undefined;
  cpu?: number | undefined;
  memory?: number | undefined;
}

export interface VerificationCheckItem {
  id: string;
  title: string;
  passed: boolean;
  message: string;
}

export interface VerificationResponse {
  verified: boolean;
  checks: VerificationCheckItem[];
  layout?: "git" | "releases";
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
    sharedPaths?: string[] | undefined;
  };
}

/**
 * Prefer an explicit layout. If the field is missing (older proxy or a stripped
 * body), a cwd with no releases/current paths is a git checkout — not Capistrano.
 * Defaulting that case to releases is what made Sahaay fail `releases/` + `current`
 * while the wizard said git.
 */
export function resolvePm2VerifyLayout(target: VerifyRequestBody["target"]): "git" | "releases" {
  if (target.layout === "git") return "git";
  if (target.layout === "releases") return "releases";
  const hasCwd = typeof target.cwd === "string" && target.cwd.length > 0;
  const hasReleasesLayout = Boolean(target.releasesDir) || Boolean(target.currentSymlink);
  if (hasCwd && !hasReleasesLayout) return "git";
  return "releases";
}

interface RawPm2Env {
  status?: string;
  restart_time?: number;
  pm_uptime?: number;
  pm_cwd?: string;
}

interface RawPm2Process {
  name?: string;
  pid?: number;
  monit?: {
    cpu?: number;
    memory?: number;
  };
  pm2_env?: RawPm2Env;
}

export interface Pm2RouteOptions {
  executor?: CommandExecutor | ExecFn;
  prismaClient?: InstallationAuthPrismaClient;
  fsAccess?: (path: string, mode?: number) => Promise<void>;
  lstat?: (path: string) => Promise<{ isSymbolicLink: () => boolean }>;
  httpFetch?: (url: string, init?: RequestInit) => Promise<{ status: number; text: () => Promise<string> }>;
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
          pid: { type: "integer" },
          cpu: { type: "number" },
          memory: { type: "number" },
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

const discoveryResponseSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      required: ["runtime", "connected", "processes"],
      properties: {
        runtime: { type: "string" },
        connected: { type: "boolean" },
        processes: {
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
              pid: { type: "integer" },
              cpu: { type: "number" },
              memory: { type: "number" },
            },
            additionalProperties: false,
          },
        },
        error: { type: "string" },
      },
      additionalProperties: false,
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
 * GET /v1/pm2/apps — returns read-only pm2 process summary (name, status, restarts, uptime, cwd, pid, cpu, memory).
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

  app.get("/v1/pm2/discovery", { schema: discoveryResponseSchema }, async (request, reply) => {
    const installationId = await resolveInstallationFromAuthHeader(prismaClient, request.headers.authorization);
    if (!installationId) {
      return reply.code(401).send({ error: "missing or invalid Authorization: Bearer <installation API key> header" });
    }

    const adapter = new PM2Adapter("", { exec: executor });
    const result = await adapter.discover();
    return reply.code(200).send(result);
  });

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

          const item: Pm2AppInfo = {
            name: proc.name!,
            status,
            restarts,
            uptime,
            cwd: pm2Env.pm_cwd,
          };
          if (typeof proc.pid === "number") item.pid = proc.pid;
          if (typeof proc.monit?.cpu === "number") item.cpu = proc.monit.cpu;
          if (typeof proc.monit?.memory === "number") item.memory = proc.monit.memory;
          return item;
        });

      return reply.code(200).send(sanitized);
    } catch (error) {
      request.log.error({ error }, "failed to execute pm2 jlist");
      return reply.code(500).send({ error: "Failed to query PM2 process list on host" });
    }
  });

  const checkAccess = options.fsAccess ?? access;
  const doFetch =
    options.httpFetch ??
    (fetch as unknown as (url: string, init?: RequestInit) => Promise<{ status: number; text: () => Promise<string> }>);

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
      if (!Array.isArray(pm2List)) throw new Error("Invalid PM2 process list format");
      checks.push({
        id: "pm2_daemon",
        title: "PM2 Daemon Reachability",
        passed: true,
        message: "PM2 daemon is reachable and responding",
      });
    } catch (err: unknown) {
      pm2List = [];
      checks.push({
        id: "pm2_daemon",
        title: "PM2 Daemon Reachability",
        passed: false,
        message: `Failed to query PM2 daemon: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }

    // Check 2: Target app in process table
    const targetName = body.target.name;
    const foundProc = findPm2Process(pm2List, targetName);
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
      } catch (err: unknown) {
        checks.push({
          id: "health_url",
          title: "HTTP Health Probe",
          passed: false,
          message: `Health check request failed: ${err instanceof Error ? err.message : "Network error"}`,
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

    // Layout-specific filesystem checks. Git checkout must not require Capistrano
    // releases/ + current symlink; those paths only apply to layout: "releases".
    const layout = resolvePm2VerifyLayout(body.target);

    const testPath = async (p: string, flag: "-d" | "-e" | "-L" | "-w"): Promise<void> => {
      if (flag === "-L") {
        if (options.lstat) {
          const stat = await options.lstat(p);
          if (!stat.isSymbolicLink()) {
            throw new Error("not a symbolic link");
          }
          return;
        }
        await executor.exec(`test -L "${p}"`);
        return;
      }
      if (options.fsAccess) {
        await checkAccess(p, flag === "-w" ? fsConstants.W_OK : undefined);
        return;
      }
      await executor.exec(`test ${flag} "${p}"`);
    };

    if (layout === "git") {
      const workDir = body.target.cwd;
      if (!workDir) {
        checks.push({
          id: "working_directory",
          title: "Working Directory",
          passed: false,
          message: "Git layout requires target.cwd (the in-place checkout path)",
        });
        checks.push({
          id: "git_metadata",
          title: "Git Checkout",
          passed: false,
          message: "Skipped: working directory is not set",
        });
      } else {
        try {
          await testPath(workDir, "-d");
          checks.push({
            id: "working_directory",
            title: "Working Directory",
            passed: true,
            message: `Working directory '${workDir}' exists on host`,
          });
        } catch (err: unknown) {
          checks.push({
            id: "working_directory",
            title: "Working Directory",
            passed: false,
            message: `Working directory '${workDir}' not found: ${err instanceof Error ? err.message : "Directory does not exist"}`,
          });
        }
        try {
          await testPath(`${workDir}/.git`, "-d");
          checks.push({
            id: "git_metadata",
            title: "Git Checkout",
            passed: true,
            message: `'${workDir}' contains a .git directory`,
          });
        } catch {
          try {
            const { stdout } = await executor.exec(`git -C "${workDir}" rev-parse --is-inside-work-tree`);
            const inside = stdout.trim() === "true";
            checks.push({
              id: "git_metadata",
              title: "Git Checkout",
              passed: inside,
              message: inside
                ? `'${workDir}' is inside a git work tree`
                : `'${workDir}' is not a git checkout (git rev-parse returned ${stdout.trim() || "empty"})`,
            });
          } catch (err: unknown) {
            checks.push({
              id: "git_metadata",
              title: "Git Checkout",
              passed: false,
              message: `'${workDir}' has no .git metadata (${err instanceof Error ? err.message : "not a git repo"}). Git checkout rollback requires a clone.`,
            });
          }
        }
      }

      checks.push({
        id: "shared_paths",
        title: "Shared Paths",
        passed: true,
        message: "Shared paths are not used for git layout",
      });

      const permDir = workDir || ".";
      try {
        await testPath(permDir, "-w");
        checks.push({
          id: "rollback_permission",
          title: "Rollback Permission",
          passed: true,
          message: `Directory '${permDir}' is writable for git checkout rollback`,
        });
      } catch (err: unknown) {
        checks.push({
          id: "rollback_permission",
          title: "Rollback Permission",
          passed: false,
          message: `Directory '${permDir}' is not writable: ${err instanceof Error ? err.message : "Permission denied"}`,
        });
      }
    } else {
      // Check 4: Releases directory exists
      const releasesDir = body.target.releasesDir || (body.target.cwd ? `${body.target.cwd}/releases` : "/var/www/releases");
      let releasesDirPassed = false;
      let releasesDirMsg = "";
      try {
        if (options.fsAccess) {
          await checkAccess(releasesDir);
          releasesDirPassed = true;
        } else {
          await executor.exec(`test -d "${releasesDir}"`);
          releasesDirPassed = true;
        }
        releasesDirMsg = `Releases directory '${releasesDir}' exists on host`;
      } catch (err: unknown) {
        releasesDirPassed = false;
        releasesDirMsg = `Releases directory '${releasesDir}' not found on host: ${err instanceof Error ? err.message : "Directory does not exist"}`;
      }
      checks.push({
        id: "releases_dir",
        title: "Releases Directory",
        passed: releasesDirPassed,
        message: releasesDirMsg,
      });

      // Check 5: Current is a symbolic link (test -L)
      const currentSymlink = body.target.currentSymlink || (body.target.cwd ? `${body.target.cwd}/current` : "/var/www/current");
      let symlinkPassed = false;
      let symlinkMsg = "";
      try {
        if (options.lstat) {
          const stat = await options.lstat(currentSymlink);
          symlinkPassed = stat.isSymbolicLink();
        } else {
          await executor.exec(`test -L "${currentSymlink}"`);
          symlinkPassed = true;
        }
        symlinkMsg = symlinkPassed
          ? `'${currentSymlink}' is a valid symbolic link`
          : `'${currentSymlink}' exists but is not a symbolic link`;
      } catch (err: unknown) {
        try {
          const stat = await lstat(currentSymlink);
          symlinkPassed = stat.isSymbolicLink();
          symlinkMsg = symlinkPassed
            ? `'${currentSymlink}' is a valid symbolic link`
            : `'${currentSymlink}' exists but is not a symbolic link`;
        } catch {
          symlinkPassed = false;
          symlinkMsg = `'${currentSymlink}' is not a symbolic link: ${err instanceof Error ? err.message : "Symlink does not exist"}`;
        }
      }
      checks.push({
        id: "current_symlink",
        title: "Current Symlink",
        passed: symlinkPassed,
        message: symlinkMsg,
      });

      // Check 6: Shared paths exist (one item each)
      const sharedPaths = body.target.sharedPaths || body.target.sharedDirs || [];
      if (sharedPaths.length === 0) {
        checks.push({
          id: "shared_paths",
          title: "Shared Paths",
          passed: true,
          message: "No shared paths configured",
        });
      } else {
        for (let i = 0; i < sharedPaths.length; i++) {
          const sharedPath = sharedPaths[i];
          if (!sharedPath) continue;
          let pathPassed = false;
          let pathMsg = "";
          try {
            if (options.fsAccess) {
              await checkAccess(sharedPath);
              pathPassed = true;
            } else {
              await executor.exec(`test -e "${sharedPath}"`);
              pathPassed = true;
            }
            pathMsg = `Shared path '${sharedPath}' exists on host`;
          } catch (err: unknown) {
            pathPassed = false;
            pathMsg = `Shared path '${sharedPath}' not found on host: ${err instanceof Error ? err.message : "Path does not exist"}`;
          }
          checks.push({
            id: `shared_path_${i}`,
            title: `Shared Path: ${sharedPath}`,
            passed: pathPassed,
            message: pathMsg,
          });
        }
      }

      // Check 7: Rollback permission check (test -w on the parent directory of current)
      const currentParentDir = path.dirname(currentSymlink);
      let permPassed = false;
      let permMsg = "";
      try {
        if (options.fsAccess) {
          await checkAccess(currentParentDir, fsConstants.W_OK);
          permPassed = true;
        } else {
          await executor.exec(`test -w "${currentParentDir}"`);
          permPassed = true;
        }
        permMsg = `Parent directory '${currentParentDir}' is writable for non-disruptive symlink swap`;
      } catch (err: unknown) {
        permPassed = false;
        permMsg = `Parent directory '${currentParentDir}' is not writable: ${err instanceof Error ? err.message : "Permission denied"}`;
      }
      checks.push({
        id: "rollback_permission",
        title: "Rollback Permission",
        passed: permPassed,
        message: permMsg,
      });
    }

    const verified = checks.every((c) => c.passed);

    // Save RepoConnection
    const repoConn = (prismaClient as unknown as {
      repoConnection?: {
        upsert: (args: unknown) => Promise<unknown>;
        findUnique?: (args: unknown) => Promise<{ storedConfig?: unknown } | null>;
      };
    }).repoConnection;
    if (repoConn && typeof repoConn.upsert === "function") {
      try {
        const where = { installationId_owner_repo: { installationId: String(installationId), owner: body.owner, repo: body.repo } };
        const existing = await repoConn.findUnique?.({ where });
        const previousConfig = existing?.storedConfig && typeof existing.storedConfig === "object" && !Array.isArray(existing.storedConfig)
          ? existing.storedConfig as Record<string, unknown>
          : {};
        const storedConfig = { ...previousConfig, ...body.target, name: foundProc?.name ?? body.target.name };
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
            deploymentIntegration: "github_actions",
            runtimeAdapter: "pm2",
            pm2Process: foundProc?.name ?? body.target.name,
            verifiedAt: verified ? new Date() : null,
            verificationReport: checks,
            storedConfig,
          },
          update: {
            deploymentIntegration: "github_actions",
            runtimeAdapter: "pm2",
            pm2Process: foundProc?.name ?? body.target.name,
            verifiedAt: verified ? new Date() : null,
            verificationReport: checks,
            ...(verified ? { storedConfig } : {}),
          },
        });
      } catch (dbErr) {
        request.log.warn({ dbErr }, "Failed to persist RepoConnection verification");
      }
    }

    return reply.code(200).send({ verified, checks, layout });
  });
}
