import Fastify, { type FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it } from "vitest";
import {
  registerMetricsRoute,
  incrementCommitsAnalyzed,
  incrementHealthReports,
  incrementRollbacksExecuted,
  resetMetricsForTesting,
} from "../../src/routes/metrics.js";

describe("GET /metrics", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    resetMetricsForTesting();
    app = Fastify();
    await registerMetricsRoute(app);
    await app.ready();
  });

  it("returns 200 with Prometheus exposition format text", async () => {
    incrementCommitsAnalyzed();
    incrementHealthReports("continue");
    incrementHealthReports("rollback");
    incrementRollbacksExecuted();

    const res = await app.inject({
      method: "GET",
      url: "/metrics",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");

    const body = res.body;
    expect(body).toContain("# TYPE carf_commits_analyzed_total counter");
    expect(body).toContain("carf_commits_analyzed_total 1");

    expect(body).toContain("# TYPE carf_health_reports_total counter");
    expect(body).toContain('carf_health_reports_total{action="continue"} 1');
    expect(body).toContain('carf_health_reports_total{action="rollback"} 1');

    expect(body).toContain("# TYPE carf_rollbacks_executed_total counter");
    expect(body).toContain("carf_rollbacks_executed_total 1");

    expect(body).toContain("# TYPE carf_uptime_seconds gauge");
  });
});
