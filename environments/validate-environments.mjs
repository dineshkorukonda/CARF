/** Static artifact validation. This does not deploy workloads or prove runtime recovery. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "core-api/package.json"));
const { loadAll } = require("js-yaml");

const references = {
  pm2: ["ecosystem.config.cjs", "deploy.sh", "deploy.ps1", "rollback.sh", "rollback.ps1", "health-check.sh", "app/v1/server.mjs", "app/v2/server.mjs", "app/broken/server.mjs"],
  docker: ["Dockerfile", "compose.yml", "deploy.sh", "deploy.ps1", "rollback.sh", "rollback.ps1", "health-check.sh"],
  kubernetes: ["namespace.yaml", "deployment-v1.yaml", "deployment-v2.yaml", "deployment-broken.yaml", "service.yaml", "rollback.sh", "rollback.ps1"],
  "argo-rollouts": ["rollout-v1.yaml", "rollout-v2.yaml", "rollout-broken.yaml", "analysis-template.yaml", "install.sh", "abort.sh", "abort.ps1"],
  flagger: ["canary.yaml", "install.sh", "deploy.sh", "trigger-failure.sh", "trigger-failure.ps1"],
};

export function validateEnvironmentArtifacts() {
  const results = Object.entries(references).map(([environment, files]) => {
    for (const file of files) {
      const absolute = path.join(root, "environments", environment, file);
      if (!fs.existsSync(absolute)) throw new Error(`Missing artifact: ${environment}/${file}`);
      if (/\.ya?ml$/.test(file)) loadAll(fs.readFileSync(absolute, "utf8"));
    }
    return { environment, status: "STATIC-VALIDATED", artifacts: files.length, runtimeVerified: false };
  });
  for (const [integration, source, guide] of [
    ["github-actions", "githubActions", "github-actions-pm2"],
    ["generic-http", "genericHttp", "generic-ci-http"],
    ["systemd", "systemd", "systemd"], ["prometheus", "promql", "prometheus"],
  ]) {
    for (const file of [`core-api/src/adapters/${source}.ts`, `docs/integrations/${guide}.md`]) {
      if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing integration artifact: ${file}`);
    }
    results.push({ environment: integration, status: "STATIC-VALIDATED", artifacts: 2, runtimeVerified: false });
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const results = validateEnvironmentArtifacts();
    console.log(JSON.stringify(results, null, 2));
    if (process.argv.includes("--require-live")) {
      console.error("Static artifacts do not establish live support. Run the opt-in runtime suites and cluster lifecycle scripts separately.");
      process.exitCode = 1;
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
