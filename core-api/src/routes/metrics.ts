import type { FastifyInstance } from "fastify";

let commitsAnalyzed = 0;
let healthReportsContinue = 0;
let healthReportsRollback = 0;
let rollbacksExecuted = 0;
const processStartTime = Date.now();

export function incrementCommitsAnalyzed(count = 1): void {
  commitsAnalyzed += count;
}

export function incrementHealthReports(action: "continue" | "rollback"): void {
  if (action === "continue") {
    healthReportsContinue += 1;
  } else {
    healthReportsRollback += 1;
  }
}

export function incrementRollbacksExecuted(count = 1): void {
  rollbacksExecuted += count;
}

export function resetMetricsForTesting(): void {
  commitsAnalyzed = 0;
  healthReportsContinue = 0;
  healthReportsRollback = 0;
  rollbacksExecuted = 0;
}

/**
 * GET /metrics — Prometheus standard exposition format endpoint providing
 * operational telemetry on commits analyzed, health reports evaluated, rollbacks executed,
 * and service uptime.
 */
export async function registerMetricsRoute(app: FastifyInstance): Promise<void> {
  app.get("/metrics", async (_request, reply) => {
    const uptimeSeconds = Math.floor((Date.now() - processStartTime) / 1000);

    const lines = [
      "# HELP carf_commits_analyzed_total Total number of commits processed by CARF.",
      "# TYPE carf_commits_analyzed_total counter",
      `carf_commits_analyzed_total ${commitsAnalyzed}`,
      "",
      "# HELP carf_health_reports_total Total number of health reports evaluated via /v1/report.",
      "# TYPE carf_health_reports_total counter",
      `carf_health_reports_total{action="continue"} ${healthReportsContinue}`,
      `carf_health_reports_total{action="rollback"} ${healthReportsRollback}`,
      "",
      "# HELP carf_rollbacks_executed_total Total number of automated rollbacks executed.",
      "# TYPE carf_rollbacks_executed_total counter",
      `carf_rollbacks_executed_total ${rollbacksExecuted}`,
      "",
      "# HELP carf_uptime_seconds Total seconds core-api has been running.",
      "# TYPE carf_uptime_seconds gauge",
      `carf_uptime_seconds ${uptimeSeconds}`,
      "",
    ];

    return reply
      .code(200)
      .header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
      .send(lines.join("\n"));
  });
}
