import { defaultExec, assertSafeTarget, LocalCommandExecutor, type ExecFn, type CommandExecutor } from "./execFn.js";
import type { RollbackAdapter } from "./rollbackAdapter.js";
import { findPm2Process } from "./pm2Process.js";

const DEFAULT_RELEASES_ROOT = "/var/www/releases";
const DEFAULT_CURRENT_SYMLINK = "/var/www/current";

export interface PM2AdapterOptions {
  /** Injected exec function or CommandExecutor, defaulting to LocalCommandExecutor */
  exec?: ExecFn | CommandExecutor | undefined;
  /** Root directory containing one release directory per commit SHA. Default: /var/www/releases. */
  releasesRoot?: string | undefined;
  /** Symlink PM2's app entry point resolves through, repointed on rollback. Default: /var/www/current. */
  currentSymlink?: string | undefined;
  /** Deployment layout: "releases" (symlink swap) or "git" (in-place git checkout). Default: "releases" */
  layout?: "releases" | "git" | undefined;
  /** Working directory for "git" layout. */
  cwd?: string | undefined;
  /** Optional build or restart command after git checkout in "git" layout. */
  buildCommand?: string | undefined;
  /** Single process name target */
  target?: string | undefined;
  /** Multiple process name targets */
  targets?: string[] | undefined;
  /** Optional HTTP health check URL or endpoint */
  healthUrl?: string | undefined;
  /** Startup grace period in seconds. Default: 60 */
  startupGraceSeconds?: number | undefined;
  /** Shared paths preserved across releases */
  sharedPaths?: string[] | undefined;
  /** Number of HTTP probes per poll interval. Default: 1 */
  probeCount?: number | undefined;
  /** Injected fetch function for HTTP health checks, defaulting to globalThis.fetch */
  fetchFn?: ((url: string) => Promise<{ ok: boolean; status: number }>) | undefined;
  /** Sleep function injected for testing */
  sleep?: ((ms: number) => Promise<void>) | undefined;
  /** Clock injected for verification grace-period tests. Defaults to Date.now. */
  now?: (() => number) | undefined;
}

interface Pm2ProcessDescription {
  name: string;
  pm_id?: number;
  pid?: number;
  monit?: {
    cpu?: number;
    memory?: number;
  };
  pm2_env?: {
    status?: string;
    restart_time?: number;
    unstable_restarts?: number;
    pm_uptime?: number;
    pm_cwd?: string;
  };
}

export interface PM2HealthResult {
  errorRate: number;
  healthy: boolean;
  processErrorRate: number;
  httpErrorRate: number;
}

export interface PM2DiscoveredProcess {
  name: string;
  status: string;
  pid?: number | undefined;
  uptime: number; // in seconds
  cpu: number; // percentage
  memory: number; // in bytes
  restarts: number;
  cwd?: string | undefined;
}

export interface PM2DiscoveryResult {
  runtime: "pm2";
  connected: boolean;
  processes: PM2DiscoveredProcess[];
  error?: string;
}

/**
 * `RollbackAdapter` backed by PM2, supporting:
 * - Single or multiple named processes (`target` / `targets`).
 * - Dual health metrics: `pm2 jlist` process state + restart deltas + HTTP `healthUrl` probes.
 * - Dual deployment layouts: Capistrano-style symlink swap (`releases`) or in-place `git checkout` (`git`).
 * - Post-rollback verification via `rollbackWithVerification`.
 * - Local process discovery and inspection via `discover()` and `getProcess()`.
 */
export class PM2Adapter implements RollbackAdapter {
  private readonly executor: CommandExecutor;
  private readonly releasesRoot: string;
  private readonly currentSymlink: string;
  private readonly layout: "releases" | "git";
  private readonly cwd?: string | undefined;
  private readonly buildCommand?: string | undefined;
  private readonly defaultTargets: string[];
  private readonly healthUrl?: string | undefined;
  private readonly startupGraceSeconds: number;
  private readonly sharedPaths: string[];
  private readonly probeCount: number;
  private readonly fetchFn: (url: string) => Promise<{ ok: boolean; status: number }>;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly baselineRestarts = new Map<string | number, number>();

  constructor(
    private previousSha: string = "",
    options: PM2AdapterOptions = {}
  ) {
    if (previousSha && previousSha.trim().length > 0) {
      assertSafeTarget(previousSha, "previousSha");
    }

    if (options.exec) {
      if (typeof options.exec === "function") {
        this.executor = new LocalCommandExecutor(options.exec);
      } else {
        this.executor = options.exec;
      }
    } else {
      this.executor = new LocalCommandExecutor(defaultExec);
    }

    this.layout = options.layout ?? "releases";
    this.releasesRoot = options.releasesRoot ?? DEFAULT_RELEASES_ROOT;
    this.currentSymlink = options.currentSymlink ?? DEFAULT_CURRENT_SYMLINK;
    this.cwd = options.cwd;
    this.buildCommand = options.buildCommand;
    this.healthUrl = options.healthUrl;
    this.startupGraceSeconds = options.startupGraceSeconds ?? 60;
    this.sharedPaths = options.sharedPaths ?? [];
    this.probeCount = options.probeCount ?? 1;
    this.fetchFn = options.fetchFn ?? ((url: string) => globalThis.fetch(url, { signal: AbortSignal.timeout(5_000) }));
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now ?? Date.now;

    assertSafeTarget(this.releasesRoot, "releasesRoot");
    assertSafeTarget(this.currentSymlink, "currentSymlink");
    if (this.cwd) {
      assertSafeTarget(this.cwd, "cwd");
    }
    if (this.buildCommand) {
      if (/[\n\r`$]/.test(this.buildCommand)) {
        throw new Error(`Invalid buildCommand "${this.buildCommand}": contains illegal shell characters`);
      }
    }

    const targets: string[] = [];
    if (options.target) {
      assertSafeTarget(options.target, "target");
      targets.push(options.target);
    }
    if (options.targets) {
      for (const t of options.targets) {
        assertSafeTarget(t, "targets");
        if (!targets.includes(t)) {
          targets.push(t);
        }
      }
    }
    this.defaultTargets = targets;
  }

  /**
   * Static utility to quickly check if PM2 is reachable locally.
   */
  static async isAvailable(executor: CommandExecutor = new LocalCommandExecutor(defaultExec)): Promise<boolean> {
    try {
      const { stdout } = await executor.exec("pm2 jlist");
      return Array.isArray(JSON.parse(stdout));
    } catch {
      return false;
    }
  }

  /**
   * Discovers and parses local PM2 processes via safe `pm2 jlist`.
   * Returns structured runtime and process details.
   */
  async discover(): Promise<PM2DiscoveryResult> {
    try {
      const { stdout } = await this.executor.exec("pm2 jlist");
      const rawProcesses: Array<Record<string, unknown>> = JSON.parse(stdout);
      if (!Array.isArray(rawProcesses)) {
        return {
          runtime: "pm2",
          connected: false,
          processes: [],
          error: "Invalid PM2 process list format",
        };
      }

      const nowMs = this.now();
      const processes: PM2DiscoveredProcess[] = rawProcesses
        .filter((p) => typeof p.name === "string" && p.name.trim().length > 0)
        .map((p) => {
          const pm2Env = (p.pm2_env && typeof p.pm2_env === "object" ? p.pm2_env : {}) as Record<string, unknown>;
          const monit = (p.monit && typeof p.monit === "object" ? p.monit : {}) as Record<string, unknown>;
          const uptimeMs =
            typeof pm2Env.pm_uptime === "number" && pm2Env.pm_uptime > 0
              ? Math.max(0, nowMs - pm2Env.pm_uptime)
              : 0;

          return {
            name: typeof p.name === "string" ? p.name : "unknown",
            status: typeof pm2Env.status === "string" ? pm2Env.status : "unknown",
            pid: typeof p.pid === "number" && p.pid > 0 ? p.pid : undefined,
            uptime: Math.floor(uptimeMs / 1000),
            cpu: typeof monit.cpu === "number" ? Math.round(monit.cpu * 10) / 10 : 0,
            memory: typeof monit.memory === "number" ? monit.memory : 0,
            restarts: typeof pm2Env.restart_time === "number" ? pm2Env.restart_time : 0,
            cwd: typeof pm2Env.pm_cwd === "string" ? pm2Env.pm_cwd : undefined,
          };
        });

      return {
        runtime: "pm2",
        connected: true,
        processes,
      };
    } catch (err: unknown) {
      return {
        runtime: "pm2",
        connected: false,
        processes: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Retrieves a specific process by name.
   */
  async getProcess(name: string): Promise<PM2DiscoveredProcess | null> {
    assertSafeTarget(name, "processName");
    const discovery = await this.discover();
    if (!discovery.connected) return null;
    return findPm2Process(discovery.processes, name) ?? null;
  }

  /**
   * Returns current PM2 discovery status.
   */
  async getStatus(): Promise<PM2DiscoveryResult> {
    return this.discover();
  }

  /**
   * Restarts a PM2 process by name.
   */
  async restart(name: string): Promise<void> {
    assertSafeTarget(name, "processName");
    await this.runProcessCommand("restart", "", name);
  }

  /**
   * Reloads a PM2 process by name, with case-insensitive fallback if process name is capitalized.
   */
  async reload(name: string): Promise<void> {
    assertSafeTarget(name, "processName");
    await this.runProcessCommand("reload", "", name);
  }

  private async runProcessCommand(action: "reload" | "restart", cwdPrefix: string, targetArgs: string): Promise<void> {
    try {
      await this.executor.exec(`${cwdPrefix}pm2 ${action} ${targetArgs}`);
    } catch (err) {
      if (!(err instanceof Error) || !/Process or Namespace .*not found/i.test(err.message)) throw err;
      const discovery = await this.discover();
      const names = targetArgs.split(" ").map((name) => findPm2Process(discovery.processes, name)?.name);
      if (!discovery.connected || names.some((name) => !name)) throw err;
      const canonical = names.join(" ");
      if (canonical === targetArgs) throw err;
      for (const name of names) assertSafeTarget(name!, "processName");
      await this.executor.exec(`${cwdPrefix}pm2 ${action} ${canonical}`);
    }
  }

  private resolveTargets(target?: string): string[] {
    if (target && target.trim().length > 0) {
      const parsed = target.split(",").map((s) => s.trim()).filter(Boolean);
      for (const t of parsed) {
        assertSafeTarget(t, "target");
      }
      return parsed;
    }
    return this.defaultTargets;
  }

  /**
   * Reloads target processes, with case-insensitive fallback if exact name fails.
   */
  private async safeReload(cwdPrefix: string, targetArgs: string): Promise<void> {
    await this.runProcessCommand("reload", cwdPrefix, targetArgs);
  }

  async checkHealth(target?: string): Promise<PM2HealthResult> {
    const targets = this.resolveTargets(target);
    if (targets.length === 0) {
      return { errorRate: 1, healthy: false, processErrorRate: 1, httpErrorRate: 0 };
    }

    // 1. Process health via PM2
    const { stdout } = await this.executor.exec("pm2 jlist");
    let processes: Pm2ProcessDescription[] = [];
    try {
      processes = JSON.parse(stdout);
      if (!Array.isArray(processes)) throw new Error("Invalid PM2 process list");
    } catch {
      return { errorRate: 1, healthy: false, processErrorRate: 1, httpErrorRate: 0 };
    }

    const targetErrorRates: number[] = [];

    for (const targetName of targets) {
      const canonicalName = findPm2Process(processes, targetName)?.name;
      const matching = canonicalName ? processes.filter((p) => p.name === canonicalName) : [];
      if (matching.length === 0) {
        targetErrorRates.push(1);
        continue;
      }

      let unhealthyCount = 0;
      for (const p of matching) {
        const procKey = p.pm_id !== undefined ? p.pm_id : `${p.name}`;
        const currentRestarts = p.pm2_env?.restart_time ?? 0;

        if (!this.baselineRestarts.has(procKey)) {
          this.baselineRestarts.set(procKey, currentRestarts);
        }

        const baseline = this.baselineRestarts.get(procKey) ?? 0;
        const hasRestarted = currentRestarts > baseline;
        const isOnline = p.pm2_env?.status === "online";

        if (!isOnline || hasRestarted) {
          unhealthyCount++;
        }
      }

      targetErrorRates.push(unhealthyCount / matching.length);
    }

    const processErrorRate = Math.max(...targetErrorRates);

    // 2. HTTP health check (if configured)
    let httpErrorRate = 0;
    if (this.healthUrl) {
      let failedProbes = 0;
      for (let i = 0; i < this.probeCount; i++) {
        try {
          const res = await this.fetchFn(this.healthUrl);
          if (!res.ok || res.status < 200 || res.status >= 300) {
            failedProbes++;
          }
        } catch {
          failedProbes++;
        }
      }
      httpErrorRate = failedProbes / this.probeCount;
    }

    const errorRate = Math.max(processErrorRate, httpErrorRate);
    return {
      errorRate,
      healthy: errorRate === 0,
      processErrorRate,
      httpErrorRate,
    };
  }

  async getCurrentRevision(captureForRollback = true): Promise<string> {
    const command = this.layout === "git"
      ? `${this.cwd ? `cd ${this.cwd} && ` : ""}git rev-parse HEAD`
      : `basename $(readlink -f ${this.currentSymlink})`;
    const revision = (await this.executor.exec(command)).stdout.trim();
    if (!/^[0-9a-f]{40}$/i.test(revision)) throw new Error("Cannot identify the deployed PM2 revision; deployment skipped");
    if (captureForRollback) this.previousSha = revision;
    return revision;
  }

  async applyRelease(sha: string, target?: string): Promise<void> {
    assertSafeTarget(sha, "sha");
    const targets = this.resolveTargets(target);
    if (targets.length === 0) {
      throw new Error("No target specified for PM2 applyRelease");
    }

    const targetArgs = targets.join(" ");

    if (this.layout === "git") {
      const cwdPrefix = this.cwd ? `cd ${this.cwd} && ` : "";
      await this.executor.exec(`${cwdPrefix}git fetch origin`);
      await this.executor.exec(`${cwdPrefix}git checkout ${sha}`);
      if (this.buildCommand) {
        await this.executor.exec(`${cwdPrefix}${this.buildCommand}`);
      }
      await this.safeReload(cwdPrefix, targetArgs);
    } else {
      const releaseDir = `${this.releasesRoot}/${sha}`;
      await this.executor.exec(`test -d ${releaseDir} && ln -sfn ${releaseDir} ${this.currentSymlink}`);
      await this.safeReload("", targetArgs);
    }
  }

  async rollback(target?: string): Promise<void> {
    if (!this.previousSha || this.previousSha.trim().length === 0) {
      throw new Error("Cannot rollback: previousSha was not specified.");
    }

    const targets = this.resolveTargets(target);
    if (targets.length === 0) {
      throw new Error("No target specified for PM2 rollback");
    }

    const targetArgs = targets.join(" ");

    if (this.layout === "git") {
      const cwdPrefix = this.cwd ? `cd ${this.cwd} && ` : "";
      await this.executor.exec(`${cwdPrefix}git checkout ${this.previousSha}`);
      if (this.buildCommand) {
        await this.executor.exec(`${cwdPrefix}${this.buildCommand}`);
      }
      await this.safeReload(cwdPrefix, targetArgs);
    } else {
      const releaseDir = `${this.releasesRoot}/${this.previousSha}`;
      await this.executor.exec(`test -d ${releaseDir} && ln -sfn ${releaseDir} ${this.currentSymlink}`);
      await this.safeReload("", targetArgs);
    }

    // Intentional reload always increments PM2 restart_time. Drop soak-window
    // baselines so post-rollback health does not treat that expected restart as a crash.
    this.baselineRestarts.clear();
  }

  async rollbackWithVerification(
    target?: string,
    graceSeconds?: number
  ): Promise<{ verified: boolean; errorRate: number; rollbackVerified: boolean }> {
    await this.rollback(target);
    const grace = graceSeconds ?? this.startupGraceSeconds ?? 60;
    const graceMs = grace * 1000;
    const deadline = this.now() + graceMs;

    let lastHealth: PM2HealthResult = {
      errorRate: 1,
      healthy: false,
      processErrorRate: 1,
      httpErrorRate: 0,
    };

    // Git checkout + rebuild + `pm2 reload` often leaves the process launching or
    // offline for several seconds. The grace window exists to wait for that — do not
    // fail on the first non-healthy poll, or verification spuriously fails (#147).
    while (true) {
      lastHealth = await this.checkHealth(target);

      if (lastHealth.healthy) {
        return {
          verified: true,
          errorRate: lastHealth.errorRate,
          rollbackVerified: true,
        };
      }

      const remaining = deadline - this.now();
      if (remaining <= 0) {
        break;
      }
      await this.sleep(Math.min(1000, remaining));
    }

    return {
      verified: false,
      errorRate: lastHealth.errorRate,
      rollbackVerified: false,
    };
  }
}
