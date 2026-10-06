import { describe, expect, it, vi } from "vitest";
import { PromQLAdapter } from "../../src/adapters/promql.js";

describe("PromQLAdapter (Prometheus PromQL Health Adapter)", () => {
  it("queries scalar metric from Prometheus v1 API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "success",
        data: {
          resultType: "scalar",
          result: [1670000000, "0.015"],
        },
      }),
    });

    const adapter = new PromQLAdapter({
      prometheusUrl: "http://prometheus:9090",
      query: 'sum(rate(http_requests_total{status=~"5.."}[1m])) / sum(rate(http_requests_total[1m]))',
      fetchFn: mockFetch,
    });

    const metric = await adapter.queryMetric();
    expect(metric).toBeCloseTo(0.015);
  });

  it("queries vector metric and extracts first series value", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "success",
        data: {
          resultType: "vector",
          result: [
            {
              metric: { service: "api" },
              value: [1670000000, "0.03"],
            },
          ],
        },
      }),
    });

    const adapter = new PromQLAdapter({
      prometheusUrl: "http://prometheus:9090",
      query: 'http_error_rate{env="prod"}',
      fetchFn: mockFetch,
    });

    const metric = await adapter.queryMetric();
    expect(metric).toBeCloseTo(0.03);
  });

  it("reports healthy when error rate is within threshold", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "success",
        data: {
          resultType: "scalar",
          result: [1670000000, "0.02"],
        },
      }),
    });

    const adapter = new PromQLAdapter({
      prometheusUrl: "http://prometheus:9090",
      query: "error_rate",
      threshold: 0.05,
      fetchFn: mockFetch,
    });

    const health = await adapter.checkHealth(0.05);
    expect(health.healthy).toBe(true);
    expect(health.errorRate).toBeCloseTo(0.02);
  });

  it("reports unhealthy when error rate exceeds threshold", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "success",
        data: {
          resultType: "scalar",
          result: [1670000000, "0.12"],
        },
      }),
    });

    const adapter = new PromQLAdapter({
      prometheusUrl: "http://prometheus:9090",
      query: "error_rate",
      threshold: 0.05,
      fetchFn: mockFetch,
    });

    const health = await adapter.checkHealth(0.05);
    expect(health.healthy).toBe(false);
    expect(health.errorRate).toBeCloseTo(0.12);
  });

  it("handles network failure gracefully reporting errorRate 1.0", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

    const adapter = new PromQLAdapter({
      prometheusUrl: "http://prometheus:9090",
      query: "error_rate",
      fetchFn: mockFetch,
    });

    const health = await adapter.checkHealth(0.05);
    expect(health.healthy).toBe(false);
    expect(health.errorRate).toBe(1.0);
  });
});
