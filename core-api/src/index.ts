import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { loadCarfConfig } from "./config/carfConfig.js";
import { githubApiClient, getInstallationTokenClient } from "./adapters/github/client.js";
import { handleWebhookCommit } from "./webhookOrchestrator.js";

// Fail closed: an invalid .carf.yml crashes startup rather than silently falling back to
// defaults -- inherited from src/config/carfConfig.ts's documented contract (see
// docs/superpowers/specs/2026-08-24-carf-yml-config-design.md).
const carfConfig = loadCarfConfig();
const installationTokenClient = getInstallationTokenClient();

// The onValidWebhook closure below references `app.log` -- it's only ever invoked later,
// on a real incoming request, by which point `app`'s const binding is already
// initialized. Standard self-referencing-closure pattern; safe despite the apparent
// ordering.
const app = buildApp({
  webhook: {
    webhookSecret: env.githubWebhookSecret(),
    onValidWebhook: (target) =>
      handleWebhookCommit(target, {
        githubApiClient,
        installationTokenClient,
        carfConfig,
        logger: app.log,
      }),
  },
});

app
  .listen({ port: env.port, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
