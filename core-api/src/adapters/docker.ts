import { assertSafeTarget, type CommandExecutor, defaultExec, type ExecFn, LocalCommandExecutor } from "./execFn.js";
import type { RuntimeAdapter, RuntimeHealthResult, RuntimeStatus } from "./contracts.js";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface DockerAdapterOptions {
  containerName?: string | undefined;
  composeFile?: string | undefined;
  healthUrl?: string | undefined;
  probeCount?: number | undefined;
  startupGraceSeconds?: number | undefined;
  exec?: CommandExecutor | ExecFn | undefined;
  fetchFn?: ((url: string) => Promise<{ ok: boolean; status: number }>) | undefined;
  sleep?: ((ms: number) => Promise<void>) | undefined;
  now?: (() => number) | undefined;
}

export interface DockerInspectOutput {
  Image?: string;
  State?: {
    Status?: string | undefined;
    Running?: boolean | undefined;
    Restarting?: boolean | undefined;
    OOMKilled?: boolean | undefined;
    Dead?: boolean | undefined;
    ExitCode?: number | undefined;
    StartedAt?: string | undefined;
  };
  RestartCount?: number | undefined;
  Config?: {
    Image?: string | undefined;
    Labels?: Record<string, string> | undefined;
  };
}

/**
 * Docker Runtime Adapter.
 * Integrates directly with Docker daemon / Docker Compose to:
 * - Discover and inspect running containers
 * - Monitor container process state and HTTP health probes
 * - Execute container release deployments and atomic rollbacks to previous image tags
 * - Perform post-rollback verification
 */
export class DockerAdapter implements RuntimeAdapter {
  readonly kind = "docker";
  private readonly executor: CommandExecutor;
  private readonly defaultContainer: string;
  private readonly composeFile?: string | undefined;
  private readonly healthUrl?: string | undefined;
  private readonly probeCount: number;
  private readonly startupGraceSeconds: number;
  private readonly fetchFn: (url: string) => Promise<{ ok: boolean; status: number }>;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly baselineRestarts = new Map<string, number>();

  constructor(
    private previousImageTag: string = "",
    options: DockerAdapterOptions = {}
  ) {
    if (previousImageTag && previousImageTag.trim().length > 0) {
      assertSafeTarget(previousImageTag, "previousImageTag");
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

    this.defaultContainer = options.containerName ?? "carf-sample-docker-app";
    assertSafeTarget(this.defaultContainer, "containerName");

    if (options.composeFile) {
      assertSafeTarget(options.composeFile, "composeFile");
      this.composeFile = options.composeFile;
    }

    this.healthUrl = options.healthUrl;
    this.probeCount = options.probeCount ?? 1;
    this.startupGraceSeconds = options.startupGraceSeconds ?? 60;
    this.fetchFn = options.fetchFn ?? ((url: string) => globalThis.fetch(url, { signal: AbortSignal.timeout(5000) }));
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.now = options.now ?? Date.now;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.executor.exec("docker --version");
      return res.stdout.toLowerCase().includes("docker");
    } catch {
      return false;
    }
  }

  async discover(): Promise<string[]> {
    try {
      const res = await this.executor.exec("docker ps --format {{.Names}}");
      return res.stdout
        .split("\n")
        .map((n) => n.trim())
        .filter((n) => n.length > 0);
    } catch {
      return [];
    }
  }

  async getStatus(target?: string): Promise<RuntimeStatus> {
    const container = target || this.defaultContainer;
    assertSafeTarget(container, "container");

    try {
      const res = await this.executor.exec(`docker inspect ${container}`);
      const parsed = JSON.parse(res.stdout) as DockerInspectOutput[];
      const info = parsed[0];

      if (!info) {
        return { target: container, status: "unknown" };
      }

      const isRunning = Boolean(info.State?.Running);
      const isDead = Boolean(info.State?.Dead || info.State?.OOMKilled);
      let status: RuntimeStatus["status"] = "online";
      if (!isRunning) status = "stopped";
      if (isDead || info.State?.ExitCode !== 0) status = "unhealthy";

      const startedAt = info.State?.StartedAt ? new Date(info.State.StartedAt).getTime() : 0;
      const uptimeSeconds = startedAt > 0 ? Math.max(0, Math.floor((this.now() - startedAt) / 1000)) : 0;

      return {
        target: container,
        version: info.Config?.Image ?? null,
        status,
        uptimeSeconds,
        instances: 1,
        metadata: {
          restartCount: info.RestartCount ?? 0,
          image: info.Config?.Image,
        },
      };
    } catch {
      return { target: container, status: "unknown" };
    }
  }

  async checkHealth(target?: string): Promise<RuntimeHealthResult> {
    const container = target || this.defaultContainer;
    assertSafeTarget(container, "container");

    let processHealthy = true;
    let processErrorRate = 0;

    try {
      const res = await this.executor.exec(`docker inspect ${container}`);
      const parsed = JSON.parse(res.stdout) as DockerInspectOutput[];
      const info = parsed[0];

      if (!info || !info.State?.Running) {
        processHealthy = false;
        processErrorRate = 1.0;
      } else {
        const currentRestarts = info.RestartCount ?? 0;
        const baseline = this.baselineRestarts.get(container);
        if (baseline === undefined) {
          this.baselineRestarts.set(container, currentRestarts);
        } else if (currentRestarts > baseline) {
          // Restart delta detected: process crashed and restarted!
          processHealthy = false;
          processErrorRate = 1.0;
        }
      }
    } catch {
      processHealthy = false;
      processErrorRate = 1.0;
    }

    let httpHealthy = true;
    let httpErrorRate = 0;

    if (this.healthUrl && processHealthy) {
      let failedProbes = 0;
      for (let i = 0; i < this.probeCount; i++) {
        try {
          const resp = await this.fetchFn(this.healthUrl);
          if (!resp.ok || resp.status < 200 || resp.status >= 300) {
            failedProbes++;
          }
        } catch {
          failedProbes++;
        }
      }
      httpErrorRate = this.probeCount > 0 ? failedProbes / this.probeCount : 0;
      httpHealthy = httpErrorRate === 0;
    }

    const overallHealthy = processHealthy && httpHealthy;
    const errorRate = Math.max(processErrorRate, httpErrorRate);

    return {
      errorRate,
      healthy: overallHealthy,
      processErrorRate,
      httpErrorRate,
      perTarget: {
        [container]: { processHealthy, httpHealthy, errorRate },
      },
    };
  }

  async applyRelease(imageTag: string, target?: string): Promise<void> {
    const container = target || this.defaultContainer;
    assertSafeTarget(container, "container");
    assertSafeTarget(imageTag, "imageTag");

    await this.recreateComposeService(container, imageTag);

    this.baselineRestarts.delete(container);
  }

  async rollback(target?: string): Promise<void> {
    const container = target || this.defaultContainer;
    assertSafeTarget(container, "container");

    if (!this.previousImageTag) {
      throw new Error("Cannot rollback Docker container: previousImageTag is not set");
    }

    await this.recreateComposeService(container, this.previousImageTag);

    this.baselineRestarts.delete(container);
  }

  async getCurrentRevision(capture = true): Promise<string> {
    const { stdout } = await this.executor.exec(`docker inspect ${this.defaultContainer}`);
    const info = (JSON.parse(stdout) as DockerInspectOutput[])[0];
    const revision = info?.Image ?? info?.Config?.Image;
    if (!revision) throw new Error("Cannot identify the current Docker image");
    assertSafeTarget(revision, "currentImage");
    if (capture) this.previousImageTag = revision;
    return revision;
  }

  private async recreateComposeService(container: string, image: string): Promise<void> {
    if (!this.composeFile) throw new Error("Docker deployment requires composeFile to preserve service ports, volumes, and environment");
    const { stdout } = await this.executor.exec(`docker inspect ${container}`);
    const info = (JSON.parse(stdout) as DockerInspectOutput[])[0];
    const service = info?.Config?.Labels?.["com.docker.compose.service"];
    if (!service) throw new Error("Target is not a Docker Compose service");
    assertSafeTarget(service, "composeService");
    const directory = await mkdtemp(join(tmpdir(), "carf-compose-"));
    const override = join(directory, "image.json");
    try {
      await writeFile(override, JSON.stringify({ services: { [service]: { image } } }));
      await this.executor.exec(`docker compose -f "${this.composeFile}" -f "${override}" up -d --no-build --no-deps --force-recreate ${service}`);
    } finally {
      await unlink(override).catch(() => undefined);
      await rmdir(directory);
    }
  }

  async rollbackWithVerification(
    target?: string,
    graceSeconds: number = this.startupGraceSeconds
  ): Promise<{ rollbackVerified: boolean; verified?: boolean; errorRate?: number }> {
    const container = target || this.defaultContainer;
    await this.rollback(container);

    const deadline = this.now() + graceSeconds * 1000;
    let lastErrorRate = 1.0;

    while (this.now() < deadline) {
      await this.sleep(1000);
      const health = await this.checkHealth(container);
      lastErrorRate = health.errorRate;
      if (health.healthy) {
        return { rollbackVerified: true, verified: true, errorRate: 0 };
      }
    }

    return { rollbackVerified: false, verified: false, errorRate: lastErrorRate };
  }

  async restart(target?: string): Promise<void> {
    const container = target || this.defaultContainer;
    assertSafeTarget(container, "container");
    await this.executor.exec(`docker restart ${container}`);
    this.baselineRestarts.delete(container);
  }
}
