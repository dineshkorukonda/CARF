import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { loadCarfConfig } from "./config/carfConfig.js";
import { watchCarfConfig } from "./config/carfConfigWatcher.js";
import { githubApiClient, getInstallationTokenClient } from "./adapters/github/client.js";
import { handleWebhookCommit } from "./webhookOrchestrator.js";

// Issue #60: real end-to-end webhook test commit.
// Issue #60: second probe -- retest push webhook delivery after the earlier 404.
// Fail closed: an invalid .carf.yml crashes startup rather than silently falling back to
// defaults -- inherited from src/config/carfConfig.ts's documented contract (see
// docs/superpowers/specs/2026-08-24-carf-yml-config-design.md). `let`, not `const`: the
// watcher below reassigns this on a successful hot-reload (issue #57). The onValidWebhook
// closure reads this binding fresh on every call, so a reassignment here is picked up by
// the very next webhook without any change to webhookOrchestrator.ts's interface.
let carfConfig = loadCarfConfig();
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

watchCarfConfig({
  onReload: (reloaded) => {
    carfConfig = reloaded;
    app.log.info("carfConfig reloaded from .carf.yml");
  },
  onError: (error) => {
    // Fail closed: `carfConfig` is left untouched, so the last-known-good config keeps
    // serving webhooks -- matches loadCarfConfig()'s own initial-load contract.
    app.log.error({ error }, "failed to reload .carf.yml, keeping last-known-good config");
  },
});

app
  .listen({ port: env.port, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
