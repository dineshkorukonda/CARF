import { defaultExec, type ExecFn } from "./execFn.js";
import type { RollbackAdapter } from "./rollbackAdapter.js";

export interface DockerSwarmAdapterOptions {
  /** Injected exec function, defaulting to Node's real `child_process.exec`, promisified. */
  exec?: ExecFn;
}

interface SwarmTask {
  CurrentState: string;
  DesiredState: string;
}

/**
 * `RollbackAdapter` backed by Docker Swarm, targeting a service by name.
 *
 * Health convention: `docker service ps <target> --filter desired-state=running --format
 * json` emits one JSON object per currently-desired task (the `--filter` excludes stale
 * shutdown tasks left over from previous updates, which `docker service ps` otherwise
 * keeps in its history). A task counts as unhealthy if its `CurrentState` doesn't start
 * with `"Running"` (e.g. `"Failed ..."`, `"Shutdown ..."`, `"Pending ..."`). `errorRate` is
 * the fraction of unhealthy tasks; an empty result is treated as fully unhealthy rather
 * than a healthy empty set, same convention as the other exec-based adapters.
 *
 * Rollback: `docker service update --rollback <target>`. Swarm tracks the previous spec
 * itself (like `kubectl rollout undo`) — no explicit previous-version bookkeeping needed
 * on our side, unlike `DockerComposeAdapter`'s `previousImageTag` gap (issue #50).
 */
export class DockerSwarmAdapter implements RollbackAdapter {
  private readonly exec: ExecFn;

  constructor(options: DockerSwarmAdapterOptions = {}) {
    this.exec = options.exec ?? defaultExec;
  }

  async checkHealth(target: string): Promise<{ errorRate: number; healthy: boolean }> {
    const { stdout } = await this.exec(`docker service ps ${target} --filter desired-state=running --format json`);
    const lines = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return { errorRate: 1, healthy: false };
    }

    const tasks: SwarmTask[] = lines.map((line) => JSON.parse(line));
    const unhealthyCount = tasks.filter((t) => !t.CurrentState.startsWith("Running")).length;
    const errorRate = unhealthyCount / tasks.length;

    return { errorRate, healthy: errorRate === 0 };
  }

  async rollback(target: string): Promise<void> {
    await this.exec(`docker service update --rollback ${target}`);
  }
}
