import { generateSyntheticDeployments } from "./injector.js";
import { runEvaluation } from "./runHarness.js";
import { writeReport } from "./report.js";
import { loadCarfConfig } from "../config/carfConfig.js";
import { mergeThresholdConfig } from "../config/mergeThresholdConfig.js";

// `npm run evaluate` entrypoint. Requires DATABASE_URL, same as any other code path that
// touches the real Prisma client (see src/pipeline.ts) — EvaluationLog rows are written
// for every deployment/condition pair.
const DEPLOYMENT_COUNT = 100;

async function main(): Promise<void> {
  // Loads .carf.yml from the repo root if present (config-only wiring —
  // mode/adapter are validated but unused here; see
  // docs/superpowers/specs/2026-08-24-carf-yml-config-design.md).
  const carfConfig = loadCarfConfig();

  const deployments = generateSyntheticDeployments(DEPLOYMENT_COUNT);
  const results = await runEvaluation(deployments, {
    thresholdConfig: mergeThresholdConfig(carfConfig?.threshold),
    classificationRules: carfConfig?.classification?.rules ?? [],
  });
  const markdown = writeReport(results);
  console.log(markdown);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
