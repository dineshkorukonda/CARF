import type { RollbackAdapter } from "./rollbackAdapter.js";

/**
 * Minimal structural subset of the global `Response` type this adapter uses. Real global
 * `fetch()` satisfies this structurally, so the default parameter can just be `fetch` —
 * tests inject a smaller fake. Mirrors `adapters/github/fetchTypes.ts`'s convention,
 * duplicated locally rather than shared since this adapter isn't GitHub-specific.
 */
export interface MinimalFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<MinimalFetchResponse>;

export interface GitOpsAdapterOptions {
  /** Injected fetch function, defaulting to the global `fetch`. */
  fetch?: FetchFn;
}

interface ArgoCdHistoryEntry {
  id: number;
  revision: string;
}

interface ArgoCdApplication {
  status?: {
    health?: { status?: string };
    history?: ArgoCdHistoryEntry[];
  };
}

/**
 * `RollbackAdapter` backed by Argo CD's REST API — CARF's GitOps ecosystem partner
 * (`examples/argo-rollouts-analysistemplate.yaml` already integrates with the Argo family
 * for Augment mode; this extends the same ecosystem to Standalone mode, where CARF drives
 * the revert itself).
 *
 * Health convention: `GET /api/v1/applications/<target>`. `errorRate` is binary (1 unless
 * `status.health.status === "Healthy"`) rather than a fraction, since Argo CD's health
 * status is already an aggregate signal computed from the underlying resources, not a
 * per-replica count the way `KubectlAdapter`'s/`DockerComposeAdapter`'s are.
 *
 * Rollback convention: Argo CD's rollback endpoint takes a numeric deployment-history id,
 * not a git revision directly. `rollback()` first fetches the target's history, finds the
 * entry whose `revision` matches `previousRevision` (constructor arg, analogous to
 * `DockerComposeAdapter`'s `previousImageTag` / `PM2Adapter`'s `previousSha`), then calls
 * the rollback endpoint with that entry's id. Throws if no matching entry exists — rolling
 * back to a revision Argo CD never actually deployed isn't a safe no-op, it's a real
 * failure that should surface rather than be swallowed.
 */
export class GitOpsAdapter implements RollbackAdapter {
  private readonly fetchFn: FetchFn;

  constructor(
    private readonly previousRevision: string,
    private readonly baseUrl: string,
    private readonly token: string,
    options: GitOpsAdapterOptions = {}
  ) {
    this.fetchFn = options.fetch ?? fetch;
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}`, Accept: "application/json" };
  }

  private async getApplication(target: string): Promise<ArgoCdApplication> {
    const response = await this.fetchFn(`${this.baseUrl}/api/v1/applications/${target}`, {
      headers: this.authHeaders(),
    });
    if (!response.ok) {
      throw new Error(`GitOpsAdapter: failed to fetch application ${target} (status ${response.status})`);
    }
    return (await response.json()) as ArgoCdApplication;
  }

  async checkHealth(target: string): Promise<{ errorRate: number; healthy: boolean }> {
    let app: ArgoCdApplication;
    try {
      app = await this.getApplication(target);
    } catch {
      return { errorRate: 1, healthy: false };
    }
    const healthy = app.status?.health?.status === "Healthy";
    return { errorRate: healthy ? 0 : 1, healthy };
  }

  async rollback(target: string): Promise<void> {
    const app = await this.getApplication(target);
    const historyEntry = app.status?.history?.find((h) => h.revision === this.previousRevision);
    if (!historyEntry) {
      throw new Error(
        `GitOpsAdapter: no deployment history entry for revision ${this.previousRevision} found on application ${target}`
      );
    }

    const response = await this.fetchFn(`${this.baseUrl}/api/v1/applications/${target}/rollback`, {
      method: "POST",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ id: historyEntry.id }),
    });
    if (!response.ok) {
      throw new Error(`GitOpsAdapter: rollback request failed for application ${target} (status ${response.status})`);
    }
  }
}
