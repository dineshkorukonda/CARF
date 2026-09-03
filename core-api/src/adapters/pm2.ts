import { defaultExec, assertSafeTarget, type ExecFn } from "./execFn.js";
import type { RollbackAdapter } from "./rollbackAdapter.js";

const DEFAULT_RELEASES_ROOT = "/var/www/releases";
const DEFAULT_CURRENT_SYMLINK = "/var/www/current";

export interface PM2AdapterOptions {
  /** Injected exec function, defaulting to Node's real `child_process.exec`, promisified. */
  exec?: ExecFn;
  /** Root directory containing one release directory per commit SHA. Default: /var/www/releases. */
  releasesRoot?: string;
  /** Symlink PM2's app entry point resolves through, repointed on rollback. Default: /var/www/current. */
  currentSymlink?: string;
}

interface Pm2ProcessDescription {
  name: string;
  pm2_env?: { status?: string };
}

/**
 * `RollbackAdapter` backed by PM2, targeting a named process (or process group — PM2
 * cluster mode reports one `pm jlist` entry per instance, all sharing `name`).
 *
 * Health convention: `pm2 jlist` filtered to entries whose `name` matches `target`.
 * `errorRate` is the fraction whose `pm2_env.status` isn't `"online"`. No matching entries
 * (unknown process name) counts as fully unhealthy rather than a healthy empty set, same
 * convention as `DockerComposeAdapter`.
 *
 * Rollback convention: the deployment pipeline keeps one release directory per commit SHA
 * under `releasesRoot` (`${releasesRoot}/${sha}`, Capistrano-style), and PM2's app script
 * is reached through `currentSymlink`. Rollback repoints that symlink at the previous
 * release, then `pm2 reload`s (not `restart` — zero-downtime for cluster-mode apps) so the
 * process picks up the previous code. Same "release directory named by commit SHA"
 * assumption as `DockerComposeAdapter`'s `IMAGE_TAG` convention — `webhookOrchestrator.ts`
 * derives the previous SHA from the webhook's `baseSha` for both, and both are restricted
 * to `push` events for the same reason (see issue #50's `pull_request`/`baseSha` fix).
 */
export class PM2Adapter implements RollbackAdapter {
  private readonly exec: ExecFn;
  private readonly releasesRoot: string;
  private readonly currentSymlink: string;

  constructor(
    private readonly previousSha: string,
    options: PM2AdapterOptions = {}
  ) {
    assertSafeTarget(previousSha, "previousSha");
    this.exec = options.exec ?? defaultExec;
    this.releasesRoot = options.releasesRoot ?? DEFAULT_RELEASES_ROOT;
    this.currentSymlink = options.currentSymlink ?? DEFAULT_CURRENT_SYMLINK;
    assertSafeTarget(this.releasesRoot, "releasesRoot");
    assertSafeTarget(this.currentSymlink, "currentSymlink");
  }

  async checkHealth(target: string): Promise<{ errorRate: number; healthy: boolean }> {
    assertSafeTarget(target);
    const { stdout } = await this.exec("pm2 jlist");
    const processes: Pm2ProcessDescription[] = JSON.parse(stdout);
    const matching = processes.filter((p) => p.name === target);

    if (matching.length === 0) {
      return { errorRate: 1, healthy: false };
    }

    const unhealthyCount = matching.filter((p) => p.pm2_env?.status !== "online").length;
    const errorRate = unhealthyCount / matching.length;

    return { errorRate, healthy: errorRate === 0 };
  }

  async rollback(target: string): Promise<void> {
    assertSafeTarget(target);
    const releaseDir = `${this.releasesRoot}/${this.previousSha}`;
    await this.exec(`test -d ${releaseDir} && ln -sfn ${releaseDir} ${this.currentSymlink}`);
    await this.exec(`pm2 reload ${target}`);
  }
}
