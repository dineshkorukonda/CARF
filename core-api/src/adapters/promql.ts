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

export interface PrometheusVectorResult {
  metric?: Record<string, string>;
  value?: [number, string];
}

export type PrometheusScalarResult = [number, string];

export interface PrometheusQueryResponse {
  status: "success" | "error";
  errorType?: string;
  error?: string;
  data?: {
    resultType: "vector" | "matrix" | "scalar" | "string";
    result: PrometheusVectorResult[] | PrometheusScalarResult;
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
    if (!options.query) {
      throw new Error("PromQLAdapter requires a valid PromQL query");
    }

    this.prometheusUrl = options.prometheusUrl.replace(/\/+$/, "");
    this.query = options.query;
    this.threshold = options.threshold ?? 0.05;
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.fetchFn =
      options.fetchFn ??
      ((url: string, init?: RequestInit) => globalThis.fetch(url, init as RequestInit));
  }

  /**
   * Queries the Prometheus instant query API and returns the parsed float value.
   */
  async queryMetric(): Promise<number> {
    const endpoint = `${this.prometheusUrl}/api/v1/query?query=${encodeURIComponent(this.query)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(endpoint, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Prometheus returned HTTP status ${response.status}`);
      }

      const body = (await response.json()) as PrometheusQueryResponse;
      if (body.status !== "success" || !body.data) {
        throw new Error(`Prometheus query error: ${body.error ?? "unknown error"}`);
      }

      const { resultType, result } = body.data;

      if (resultType === "scalar" && Array.isArray(result)) {
        const scalar = result as PrometheusScalarResult;
        const val = parseFloat(scalar[1]);
        return isNaN(val) ? 0.0 : val;
      }

      if (resultType === "vector" && Array.isArray(result) && result.length > 0) {
        const vector = result as PrometheusVectorResult[];
        const first = vector[0];
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
        healthy,
        errorRate,
        httpErrorRate: errorRate,
        processErrorRate: 0.0,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        healthy: false,
        errorRate: 1.0,
        httpErrorRate: 1.0,
        processErrorRate: 0.0,
        perTarget: { error: message },
      };
    }
  }
}
