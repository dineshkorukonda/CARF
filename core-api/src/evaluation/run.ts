import { generateSyntheticDeployments } from "./injector.js";
import { runEvaluation } from "./runHarness.js";
import { writeReport } from "./report.js";

// `npm run evaluate` entrypoint. Requires DATABASE_URL, same as any other code path that
// touches the real Prisma client (see src/pipeline.ts) — EvaluationLog rows are written
// for every deployment/condition pair.
const DEPLOYMENT_COUNT = 100;

async function main(): Promise<void> {
  const deployments = generateSyntheticDeployments(DEPLOYMENT_COUNT);
  const results = await runEvaluation(deployments);
  const markdown = writeReport(results);
  console.log(markdown);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
