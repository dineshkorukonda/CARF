import Fastify from "fastify";
import { registerThresholdRoute, type ThresholdRouteOptions } from "./routes/threshold.js";
import { registerGithubWebhookRoute, type GithubWebhookRouteOptions } from "./routes/githubWebhook.js";
import { registerGithubStatusRoute, type GithubStatusRouteOptions } from "./routes/githubStatus.js";
import { registerInstallationApiKeyRoute, type InstallationApiKeyRouteOptions } from "./routes/installationApiKey.js";
import { registerCommitsRoute, type CommitsRouteOptions } from "./routes/commits.js";
import { registerReportRoute, type ReportRouteOptions } from "./routes/report.js";
import { registerMetricsRoute } from "./routes/metrics.js";
import { registerVersionRoute } from "./routes/version.js";
import { registerPm2Route, type Pm2RouteOptions } from "./routes/pm2.js";
import { registerRolloutRollbackRoute, type RolloutRollbackRouteOptions } from "./routes/rolloutRollback.js";

export interface BuildAppOptions {
  threshold?: ThresholdRouteOptions;
  report?: ReportRouteOptions;
  webhook?: GithubWebhookRouteOptions;
  githubStatus?: GithubStatusRouteOptions;
  installationApiKey?: InstallationApiKeyRouteOptions;
  commits?: CommitsRouteOptions;
  pm2?: Pm2RouteOptions;
  rolloutRollback?: RolloutRollbackRouteOptions;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: true });

  app.get("/healthz", async () => ({ status: "ok" }));
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/v1/health", async () => ({ status: "ok", service: "carf-core-api" }));

  void registerThresholdRoute(app, options.threshold);
  void registerReportRoute(app, options.report);
  void registerGithubStatusRoute(app, options.githubStatus);
  void registerInstallationApiKeyRoute(app, options.installationApiKey);
  void registerCommitsRoute(app, options.commits);
  void registerPm2Route(app, options.pm2);
  void registerRolloutRollbackRoute(app, options.rolloutRollback);
  void registerMetricsRoute(app);
  void registerVersionRoute(app);
  if (options.webhook) {
    void registerGithubWebhookRoute(app, options.webhook);
  }

  return app;
}
