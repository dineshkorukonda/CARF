import { assertSafeTarget, type CommandExecutor, defaultExec, type ExecFn, LocalCommandExecutor } from "./execFn.js";
import type { RuntimeAdapter, RuntimeHealthResult, RuntimeStatus } from "./contracts.js";

export interface SystemdAdapterOptions {
  serviceName?: string | undefined;
  userMode?: boolean | undefined;
  workingDirectory?: string | undefined;
  healthUrl?: string | undefined;
  probeCount?: number | undefined;
  startupGraceSeconds?: number | undefined;
  exec?: CommandExecutor | ExecFn | undefined;
  fetchFn?: ((url: string) => Promise<{ ok: boolean; status: number }>) | undefined;
  sleep?: ((ms: number) => Promise<void>) | undefined;
  now?: (() => number) | undefined;
}

/**
 * Systemd Linux Runtime Adapter.
 * Integrates directly with systemd (systemctl) to:
 * - Discover and inspect native systemd unit status
 * - Monitor service health, active state, and HTTP health probes
 * - Execute service release deployments and atomic rollbacks to previous revisions
 * - Perform post-rollback status verification
 */
export class SystemdAdapter implements RuntimeAdapter {
  readonly kind = "systemd";
  private readonly executor: CommandExecutor;
  private readonly defaultService: string;
  private readonly userMode: boolean;
  private readonly workingDirectory?: string | undefined;
  private readonly healthUrl?: string | undefined;
  private readonly probeCount: number;
  private readonly startupGraceSeconds: number;
  private readonly fetchFn: (url: string) => Promise<{ ok: boolean; status: number }>;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private releaseTimestamp = 0;

  constructor(
    private readonly previousRevision: string = "",
    options: SystemdAdapterOptions = {}
  ) {
    if (previousRevision && previousRevision.trim().length > 0) {
      assertSafeTarget(previousRevision, "previousRevision");
    }
    const rawService = (options.serviceName ?? "app").trim();
    assertSafeTarget(rawService, "serviceName");
    this.defaultService = rawService;
    this.userMode = options.userMode === true;
    this.workingDirectory = options.workingDirectory;
    this.healthUrl = options.healthUrl;
    this.probeCount = options.probeCount ?? 3;
    this.startupGraceSeconds = options.startupGraceSeconds ?? 5;

    if (options.exec) {
      if (typeof options.exec === "function") {
        this.executor = new LocalCommandExecutor(options.exec);
      } else {
        this.executor = options.exec;
      }
    } else {
      this.executor = new LocalCommandExecutor(defaultExec);
    }

    this.fetchFn = options.fetchFn ?? (async (u) => fetch(u));
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now ?? (() => Date.now());
  }

  private systemctlCmd(cmd: string): string {
    const flag = this.userMode ? "--user " : "";
    return `systemctl ${flag}${cmd}`;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.executor.exec("systemctl --version");
      return res.stdout.toLowerCase().includes("systemd");
    } catch {
      return false;
    }
  }

  async discover(): Promise<string[]> {
    try {
      const cmd = this.systemctlCmd("list-units --type=service --state=running --no-legend --plain");
      const res = await this.executor.exec(cmd);
      const services = res.stdout
        .split("\n")
        .map((line) => line.trim().split(/\s+/)[0])
        .filter((name): name is string => Boolean(name && name.endsWith(".service")));
      return services.length > 0 ? services : [this.defaultService];
    } catch {
      return [this.defaultService];
    }
  }

  async getStatus(target?: string): Promise<RuntimeStatus> {
    const service = (target ?? this.defaultService).trim();
    assertSafeTarget(service, "target");

    try {
      const cmd = this.systemctlCmd(`show ${service} --property=ActiveState,SubState,MainPID,ExecMainStatus`);
      const res = await this.executor.exec(cmd);

      const props: Record<string, string> = {};
      for (const line of res.stdout.split("\n")) {
        const [k, v] = line.split("=");
        if (k && v !== undefined) props[k.trim()] = v.trim();
      }

      const activeState = props["ActiveState"] ?? "unknown";
      const isOnline = activeState === "active";

      return {
        target: service,
        status: isOnline ? "online" : activeState === "failed" ? "unhealthy" : activeState,
        connected: isOnline,
        instances: isOnline ? 1 : 0,
        metadata: {
          subState: props["SubState"],
          mainPid: props["MainPID"],
          execMainStatus: props["ExecMainStatus"],
        },
      };
    } catch {
      return {
        target: service,
        status: "unknown",
        connected: false,
        instances: 0,
      };
    }
  }

  async checkHealth(target?: string): Promise<RuntimeHealthResult> {
    const service = (target ?? this.defaultService).trim();
    assertSafeTarget(service, "target");

    let isServiceActive = false;
    try {
      const cmd = this.systemctlCmd(`is-active ${service}`);
      const res = await this.executor.exec(cmd);
      isServiceActive = res.stdout.trim() === "active";
    } catch {
      isServiceActive = false;
    }

    const processErrorRate = isServiceActive ? 0.0 : 1.0;

    let httpErrorRate = 0.0;
    if (this.healthUrl && isServiceActive) {
      let failedProbes = 0;
      for (let i = 0; i < this.probeCount; i++) {
        try {
          const res = await this.fetchFn(this.healthUrl);
          if (!res.ok) failedProbes++;
        } catch {
          failedProbes++;
        }
      }
      httpErrorRate = failedProbes / this.probeCount;
    }

    const errorRate = Math.max(processErrorRate, httpErrorRate);
    return {
      errorRate,
      healthy: errorRate === 0.0,
      processErrorRate,
      httpErrorRate,
    };
  }

  async restart(target?: string): Promise<void> {
    const service = (target ?? this.defaultService).trim();
    assertSafeTarget(service, "target");
    const cmd = this.systemctlCmd(`restart ${service}`);
    await this.executor.exec(cmd);
  }

  async reload(target?: string): Promise<void> {
    const service = (target ?? this.defaultService).trim();
    assertSafeTarget(service, "target");
    const cmd = this.systemctlCmd(`reload-or-restart ${service}`);
    await this.executor.exec(cmd);
  }

  async applyRelease(sha: string, target?: string): Promise<void> {
    assertSafeTarget(sha, "sha");
    const service = (target ?? this.defaultService).trim();
    assertSafeTarget(service, "target");

    if (this.workingDirectory) {
      await this.executor.exec(`git checkout ${sha}`, { cwd: this.workingDirectory });
    }

    await this.restart(service);
    this.releaseTimestamp = this.now();
  }

  async rollback(target?: string): Promise<void> {
    const service = (target ?? this.defaultService).trim();
    assertSafeTarget(service, "target");

    if (this.previousRevision && this.workingDirectory) {
      await this.executor.exec(`git checkout ${this.previousRevision}`, { cwd: this.workingDirectory });
    }

    await this.restart(service);
  }

  async rollbackWithVerification(
    target?: string,
    graceSeconds: number = this.startupGraceSeconds
  ): Promise<{ rollbackVerified: boolean; verified: boolean; errorRate: number }> {
    await this.rollback(target);
    if (graceSeconds > 0) {
      await this.sleep(graceSeconds * 1000);
    }
    const health = await this.checkHealth(target);
    return {
      rollbackVerified: false, // Health alone does not establish restoration identity.
      verified: false,
      errorRate: health.errorRate,
    };
  }
}
