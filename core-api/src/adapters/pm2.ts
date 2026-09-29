import { defaultExec, assertSafeTarget, LocalCommandExecutor, type ExecFn, type CommandExecutor } from "./execFn.js";
import type { RollbackAdapter } from "./rollbackAdapter.js";

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
}

interface Pm2ProcessDescription {
  name: string;
  pm_id?: number;
  pm2_env?: {
    status?: string;
    restart_time?: number;
    unstable_restarts?: number;
  };
}

export interface PM2HealthResult {
  errorRate: number;
  healthy: boolean;
  processErrorRate: number;
  httpErrorRate: number;
}

/**
 * `RollbackAdapter` backed by PM2, supporting:
 * - Single or multiple named processes (`target` / `targets`).
 * - Dual health metrics: `pm2 jlist` process state + restart deltas + HTTP `healthUrl` probes.
 * - Dual deployment layouts: Capistrano-style symlink swap (`releases`) or in-place `git checkout` (`git`).
 * - Post-rollback verification via `rollbackWithVerification`.
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
  private readonly baselineRestarts = new Map<string | number, number>();

  constructor(
    private readonly previousSha: string,
    options: PM2AdapterOptions = {}
  ) {
    assertSafeTarget(previousSha, "previousSha");

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
    this.fetchFn = options.fetchFn ?? ((url: string) => globalThis.fetch(url));
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

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
    } catch {
      return { errorRate: 1, healthy: false, processErrorRate: 1, httpErrorRate: 0 };
    }

    const targetErrorRates: number[] = [];

    for (const targetName of targets) {
      const matching = processes.filter((p) => p.name === targetName);
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
      await this.executor.exec(`${cwdPrefix}pm2 reload ${targetArgs}`);
    } else {
      const releaseDir = `${this.releasesRoot}/${sha}`;
      await this.executor.exec(`test -d ${releaseDir} && ln -sfn ${releaseDir} ${this.currentSymlink}`);
      await this.executor.exec(`pm2 reload ${targetArgs}`);
    }
  }

  async rollback(target?: string): Promise<void> {
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
      await this.executor.exec(`${cwdPrefix}pm2 reload ${targetArgs}`);
    } else {
      const releaseDir = `${this.releasesRoot}/${this.previousSha}`;
      await this.executor.exec(`test -d ${releaseDir} && ln -sfn ${releaseDir} ${this.currentSymlink}`);
      await this.executor.exec(`pm2 reload ${targetArgs}`);
    }
  }

  async rollbackWithVerification(
    target?: string,
    graceSeconds?: number
  ): Promise<{ verified: boolean; errorRate: number; rollbackVerified: boolean }> {
    await this.rollback(target);
    const grace = graceSeconds ?? this.startupGraceSeconds ?? 60;
    const graceMs = grace * 1000;
    const startTime = Date.now();

    let lastHealth: PM2HealthResult = {
      errorRate: 1,
      healthy: false,
      processErrorRate: 1,
      httpErrorRate: 0,
    };

    while (Date.now() - startTime <= graceMs) {
      lastHealth = await this.checkHealth(target);

      // Process exits or restart count deltas fail verification immediately
      if (lastHealth.processErrorRate > 0) {
        return {
          verified: false,
          errorRate: lastHealth.errorRate,
          rollbackVerified: false,
        };
      }

      // First healthy poll during grace (process online & HTTP 2xx) -> verified
      if (lastHealth.healthy) {
        return {
          verified: true,
          errorRate: lastHealth.errorRate,
          rollbackVerified: true,
        };
      }

      // If only HTTP probe failed during grace period, wait for next poll
      await this.sleep(Math.min(1000, graceMs));
    }

    // Grace period expired without reaching healthy status
    return {
      verified: false,
      errorRate: lastHealth.errorRate,
      rollbackVerified: false,
    };
  }
}
