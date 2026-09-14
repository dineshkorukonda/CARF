import { describe, expect, it, vi } from "vitest";
import { PrometheusAdapter } from "../../src/adapters/prometheus.js";

function mockFetch(jsonResponse: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => jsonResponse,
  } as Response);
}

function mockExec(stdout = "", stderr = "") {
  return vi.fn().mockResolvedValue({ stdout, stderr });
}

describe("PrometheusAdapter.checkHealth", () => {
  it("parses error rate from vector result and reports healthy when 0", async () => {
    const fetchFn = mockFetch({
      status: "success",
      data: {
        resultType: "vector",
        result: [{ metric: { job: "web-svc" }, value: [1726300000, "0.0"] }],
      },
    });

    const adapter = new PrometheusAdapter({
      prometheusUrl: "http://prom:9090",
      query: 'rate(http_requests_total{status=~"5..",job="{target}"}[1m])',
      fetchFn,
    });

    const result = await adapter.checkHealth("web-svc");

    expect(fetchFn).toHaveBeenCalledWith(
      'http://prom:9090/api/v1/query?query=rate(http_requests_total%7Bstatus%3D~%225..%22%2Cjob%3D%22web-svc%22%7D%5B1m%5D)'
    );
    expect(result).toEqual({ errorRate: 0, healthy: true });
  });

  it("extracts non-zero error rate and reports unhealthy", async () => {
    const fetchFn = mockFetch({
      status: "success",
      data: {
        resultType: "vector",
        result: [{ metric: { job: "payment" }, value: [1726300000, "0.042"] }],
      },
    });

    const adapter = new PrometheusAdapter({
      prometheusUrl: "http://prom:9090",
      fetchFn,
    });

    const result = await adapter.checkHealth("payment");

    expect(result.errorRate).toBeCloseTo(0.042, 3);
    expect(result.healthy).toBe(false);
  });

  it("handles empty result set by treating as 0 error rate", async () => {
    const fetchFn = mockFetch({
      status: "success",
      data: {
        resultType: "vector",
        result: [],
      },
    });

    const adapter = new PrometheusAdapter({ fetchFn });
    const result = await adapter.checkHealth("auth");

    expect(result).toEqual({ errorRate: 0, healthy: true });
  });

  it("treats HTTP failure as fully unhealthy", async () => {
    const fetchFn = mockFetch({ error: "gateway timeout" }, 504);
    const adapter = new PrometheusAdapter({ fetchFn });

    const result = await adapter.checkHealth("auth");
    expect(result).toEqual({ errorRate: 1, healthy: false });
  });
});

describe("PrometheusAdapter.rollback", () => {
  it("executes configured rollback command with target interpolation", async () => {
    const exec = mockExec();
    const adapter = new PrometheusAdapter({
      rollbackCommand: "kubectl rollout undo deployment/{target}",
      exec,
    });

    await adapter.rollback("frontend-service");

    expect(exec).toHaveBeenCalledWith("kubectl rollout undo deployment/frontend-service");
  });
});
