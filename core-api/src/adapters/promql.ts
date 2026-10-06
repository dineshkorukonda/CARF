import type { RuntimeHealthResult } from "./contracts.js";

export interface PromQLAdapterOptions {
  /** Base URL of the Prometheus or VictoriaMetrics server (e.g., http://prometheus:9090) */
  prometheusUrl: string;
  /** PromQL query that evaluates to an error rate between 0.0 and 1.0 (or absolute error count / ratio) */
  query: string;
  /** Maximum allowable error rate threshold ceiling (defaults to 0.05) */
  threshold?: number;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Optional custom fetch implementation */
  fetchFn?: (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
}

export interface PrometheusQueryResponse {
  status: "success" | "error";
  errorType?: string;
  error?: string;
  data?: {
    resultType: "vector" | "matrix" | "scalar" | "string";
    result: Array<{
      metric?: Record<string, string>;
      value?: [number, string];
    }> | [number, string];
  };
}

/**
 * Prometheus PromQL Telemetry Health Adapter.
 * Queries Prometheus/VictoriaMetrics instant query API to dynamically evaluate error rates and latency SLOs
 * against CARF dynamic thresholds.
 */
export class PromQLAdapter {
  readonly kind = "promql";
  private readonly prometheusUrl: string;
  private readonly query: string;
  private readonly threshold: number;
  private readonly timeoutMs: number;
  private readonly fetchFn: (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

  constructor(options: PromQLAdapterOptions) {
    if (!options.prometheusUrl) {
      throw new Error("PromQLAdapter requires a valid prometheusUrl");
    }
    this.prometheusUrl = options.prometheusUrl.replace(/\/+$/, "");
    this.query = options.query;
    this.threshold = options.threshold ?? 0.05;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.fetchFn = options.fetchFn ?? ((u, init) => fetch(u, init));
  }

  /**
   * Executes the PromQL query and extracts the scalar numerical result.
   */
  async queryMetric(customQuery?: string): Promise<number> {
    const q = customQuery ?? this.query;
    const url = `${this.prometheusUrl}/api/v1/query?query=${encodeURIComponent(q)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchFn(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Prometheus query failed with HTTP status ${res.status}`);
      }

      const body = (await res.json()) as PrometheusQueryResponse;
      if (body.status !== "success" || !body.data) {
        throw new Error(`Prometheus query error: ${body.error ?? "unknown error"}`);
      }

      const { resultType, result } = body.data;

      if (resultType === "scalar" && Array.isArray(result) && result.length >= 2) {
        const val = parseFloat(result[1] as string);
        return isNaN(val) ? 0.0 : val;
      }

      if (resultType === "vector" && Array.isArray(result) && result.length > 0) {
        const first = result[0];
        if (first?.value && Array.isArray(first.value) && first.value.length >= 2) {
          const val = parseFloat(first.value[1]);
          return isNaN(val) ? 0.0 : val;
        }
      }

      return 0.0;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Checks health by evaluating the PromQL query and comparing with the configured or runtime threshold.
   */
  async checkHealth(targetThreshold: number = this.threshold): Promise<RuntimeHealthResult> {
    try {
      const errorRate = await this.queryMetric();
      const healthy = errorRate <= targetThreshold;
      return {
        errorRate,
        healthy,
        perTarget: {
          promqlQuery: this.query,
          evaluatedValue: errorRate,
          threshold: targetThreshold,
        },
      };
    } catch {
      return {
        errorRate: 1.0,
        healthy: false,
        perTarget: {
          promqlQuery: this.query,
          error: "Failed to evaluate PromQL metric",
        },
      };
    }
  }
}
