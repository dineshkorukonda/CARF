import Fastify from "fastify";
import { registerThresholdRoute, type ThresholdRouteOptions } from "./routes/threshold.js";
import { registerGithubWebhookRoute, type GithubWebhookRouteOptions } from "./routes/githubWebhook.js";
import { registerGithubStatusRoute, type GithubStatusRouteOptions } from "./routes/githubStatus.js";

export interface BuildAppOptions {
  threshold?: ThresholdRouteOptions;
  webhook?: GithubWebhookRouteOptions;
  githubStatus?: GithubStatusRouteOptions;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: true });

  app.get("/healthz", async () => ({ status: "ok" }));

  void registerThresholdRoute(app, options.threshold);
  void registerGithubStatusRoute(app, options.githubStatus);
  if (options.webhook) {
    void registerGithubWebhookRoute(app, options.webhook);
  }

  return app;
}
