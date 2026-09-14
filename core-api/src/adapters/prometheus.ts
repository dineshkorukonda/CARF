import { assertSafeTarget, defaultExec, type ExecFn } from "./execFn.js";
import type { RollbackAdapter } from "./rollbackAdapter.js";

export interface PrometheusAdapterOptions {
  /** Base URL for Prometheus, e.g. "http://prometheus:9090". Defaults to "http://localhost:9090". */
  prometheusUrl?: string;
  /**
   * PromQL query string to evaluate error rate. May contain `{target}` which will be
   * interpolated with the target service name. Defaults to a standard error fraction:
   * `rate(http_requests_total{job="{target}",status=~"5.."}[1m]) / rate(http_requests_total{job="{target}"}[1m])`
   */
  query?: string;
  /** Optional shell command to execute rollback, interpolated with `{target}`. */
  rollbackCommand?: string;
  /** Injected fetch function for unit testing without live HTTP network calls. */
  fetchFn?: typeof fetch;
  /** Injected exec function for testing rollback command execution. */
  exec?: ExecFn;
}

const DEFAULT_PROMETHEUS_URL = "http://localhost:9090";
const DEFAULT_QUERY =
  'rate(http_requests_total{job="{target}",status=~"5.."}[1m]) / rate(http_requests_total{job="{target}"}[1m])';

interface PrometheusResponse {
  status: string;
  data?: {
    resultType: string;
    result: Array<{
      metric: Record<string, string>;
      value: [number, string];
    }>;
  };
}

/**
 * `RollbackAdapter` backed by Prometheus PromQL queries.
 *
 * `checkHealth`: Queries the configured Prometheus server with PromQL, extracting the
 * error rate scalar/vector float value. Empty result set is treated as healthy (0 error rate);
 * network/HTTP failures are treated as unhealthy (1 error rate).
 *
 * `rollback`: Executes an optional configured shell command (e.g. `kubectl rollout undo deployment/{target}`)
 * with safe target interpolation.
 */
export class PrometheusAdapter implements RollbackAdapter {
  private readonly prometheusUrl: string;
  private readonly query: string;
  private readonly rollbackCommand?: string;
  private readonly fetchFn: typeof fetch;
  private readonly exec: ExecFn;

  constructor(options: PrometheusAdapterOptions = {}) {
    this.prometheusUrl = (options.prometheusUrl ?? DEFAULT_PROMETHEUS_URL).replace(/\/+$/, "");
    this.query = options.query ?? DEFAULT_QUERY;
    this.rollbackCommand = options.rollbackCommand;
    this.fetchFn = options.fetchFn ?? fetch;
    this.exec = options.exec ?? defaultExec;
  }

  async checkHealth(target: string): Promise<{ errorRate: number; healthy: boolean }> {
    assertSafeTarget(target);
    const resolvedQuery = this.query.replace(/{target}/g, target);
    const url = `${this.prometheusUrl}/api/v1/query?query=${encodeURIComponent(resolvedQuery)}`;

    let res: Response;
    try {
      res = await this.fetchFn(url);
    } catch {
      return { errorRate: 1, healthy: false };
    }

    if (!res.ok) {
      return { errorRate: 1, healthy: false };
    }

    try {
      const data = (await res.json()) as PrometheusResponse;
      if (data.status !== "success" || !data.data || !Array.isArray(data.data.result)) {
        return { errorRate: 1, healthy: false };
      }

      if (data.data.result.length === 0) {
        return { errorRate: 0, healthy: true };
      }

      const valStr = data.data.result[0]?.value[1];
      const parsed = parseFloat(valStr ?? "0");
      const errorRate = isNaN(parsed) ? 0 : Math.max(0, parsed);

      return { errorRate, healthy: errorRate === 0 };
    } catch {
      return { errorRate: 1, healthy: false };
    }
  }

  async rollback(target: string): Promise<void> {
    assertSafeTarget(target);
    if (!this.rollbackCommand) {
      return;
    }
    const cmd = this.rollbackCommand.replace(/{target}/g, target);
    await this.exec(cmd);
  }
}
