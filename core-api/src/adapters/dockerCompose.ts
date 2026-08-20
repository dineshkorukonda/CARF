import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";
import type { RollbackAdapter } from "./rollbackAdapter.js";

export type ExecFn = (command: string) => Promise<{ stdout: string; stderr: string }>;

const defaultExec: ExecFn = promisify(execCallback);

export interface DockerComposeAdapterOptions {
  /** Injected exec function, defaulting to Node's real `child_process.exec`, promisified. */
  exec?: ExecFn;
  /** Optional `-f <file>` compose file override, applied to every invocation. */
  composeFile?: string;
}

interface ComposeContainer {
  Name: string;
  State: string;
  Health?: string;
}

/**
 * `RollbackAdapter` backed by the `docker compose` CLI.
 *
 * Health convention: `docker compose ps --format json <target>` emits one JSON object
 * per line, one per container backing the service. A container counts as unhealthy if
 * its `State` isn't `"running"`, or it declares a Docker `HEALTHCHECK` (`Health` field
 * present) whose value isn't `"healthy"`. `errorRate` is the fraction of unhealthy
 * containers; an empty result (service not found / no containers reported) is treated
 * as fully unhealthy rather than silently reporting a healthy empty set.
 *
 * Rollback: redeploys the previous image tag. Convention: the compose file pins the
 * service image via an `IMAGE_TAG` build/environment variable (e.g.
 * `image: myapp:${IMAGE_TAG:-latest}`), so rollback sets `IMAGE_TAG` to the adapter's
 * configured previous tag and runs `docker compose up -d <target>` to redeploy it.
 */
export class DockerComposeAdapter implements RollbackAdapter {
  private readonly exec: ExecFn;
  private readonly composeFileFlag: string;

  constructor(
    private readonly previousImageTag: string,
    options: DockerComposeAdapterOptions = {}
  ) {
    this.exec = options.exec ?? defaultExec;
    this.composeFileFlag = options.composeFile ? `-f ${options.composeFile} ` : "";
  }

  async checkHealth(target: string): Promise<{ errorRate: number; healthy: boolean }> {
    const { stdout } = await this.exec(`docker compose ${this.composeFileFlag}ps --format json ${target}`);
    const lines = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return { errorRate: 1, healthy: false };
    }

    const containers: ComposeContainer[] = lines.map((line) => JSON.parse(line));
    const unhealthyCount = containers.filter(
      (c) => c.State !== "running" || (c.Health !== undefined && c.Health !== "healthy")
    ).length;
    const errorRate = unhealthyCount / containers.length;

    return { errorRate, healthy: errorRate === 0 };
  }

  async rollback(target: string): Promise<void> {
    await this.exec(`IMAGE_TAG=${this.previousImageTag} docker compose ${this.composeFileFlag}up -d ${target}`);
  }
}
