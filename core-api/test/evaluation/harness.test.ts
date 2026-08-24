// Unit tests for the synthetic evaluation harness (#14 — H1 proof). Uses an in-memory
// fake EvaluationPrismaClient (no network/DB — see core-api/CLAUDE.md's "external calls
// must be mockable" convention, applied here the same way test/pipeline.test.ts applies
// it to PipelinePrismaClient) so the harness can be exercised deterministically without a
// live Postgres.

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateSyntheticDeployments } from "../../src/evaluation/injector.js";
import { runEvaluation, type EvaluationPrismaClient } from "../../src/evaluation/runHarness.js";
import { writeReport } from "../../src/evaluation/report.js";

class FakeEvaluationPrismaClient implements EvaluationPrismaClient {
  logs: Array<{ commitSha: string; condition: string; outcome: string; mttrMs?: number | null }> = [];

  evaluationLog = {
    create: async (args: { data: { commitSha: string; condition: string; outcome: string; mttrMs?: number | null } }) => {
      this.logs.push(args.data);
      return args.data;
    },
  };
}

function expectFiniteMetrics(metrics: {
  falsePositiveRate: number;
  truePositiveMttrMs: number;
  precision: number;
  recall: number;
}) {
  for (const value of Object.values(metrics)) {
    expect(Number.isNaN(value)).toBe(false);
    expect(value).not.toBeUndefined();
    expect(Number.isFinite(value)).toBe(true);
  }
  expect(metrics.falsePositiveRate).toBeGreaterThanOrEqual(0);
  expect(metrics.falsePositiveRate).toBeLessThanOrEqual(1);
  expect(metrics.precision).toBeGreaterThanOrEqual(0);
  expect(metrics.precision).toBeLessThanOrEqual(1);
  expect(metrics.recall).toBeGreaterThanOrEqual(0);
  expect(metrics.recall).toBeLessThanOrEqual(1);
  expect(metrics.truePositiveMttrMs).toBeGreaterThanOrEqual(0);
}

describe("generateSyntheticDeployments", () => {
  it("produces a ~50/50 safe/risky split", () => {
    const deployments = generateSyntheticDeployments(100);
    expect(deployments).toHaveLength(100);

    const safeCount = deployments.filter((d) => d.category === "safe").length;
    const riskyCount = deployments.filter((d) => d.category === "risky").length;

    expect(safeCount).toBe(50);
    expect(riskyCount).toBe(50);
  });

  it("ties should_fail to category consistently", () => {
    const deployments = generateSyntheticDeployments(20);
    for (const deployment of deployments) {
      expect(deployment.shouldFail).toBe(deployment.category === "risky");
      expect(deployment.changedFiles.length).toBeGreaterThan(0);
    }
  });
});

describe("runEvaluation", () => {
  it("produces valid, finite EvalMetrics for both conditions with no NaN/undefined", async () => {
    const deployments = generateSyntheticDeployments(100);
    const prismaClient = new FakeEvaluationPrismaClient();

    const { conditionA, conditionB } = await runEvaluation(deployments, { prismaClient });

    expectFiniteMetrics(conditionA);
    expectFiniteMetrics(conditionB);
    // one static-condition log + one carf_dynamic-condition log per deployment
    expect(prismaClient.logs).toHaveLength(deployments.length * 2);
  });

  it("gives Condition B (CARF dynamic) a false positive rate no worse than Condition A (static)", async () => {
    const deployments = generateSyntheticDeployments(100);
    const prismaClient = new FakeEvaluationPrismaClient();

    const { conditionA, conditionB } = await runEvaluation(deployments, { prismaClient });

    expect(conditionB.falsePositiveRate).toBeLessThanOrEqual(conditionA.falsePositiveRate);
  });

  it("threads classificationRules through to classifyCommit for every deployment", async () => {
    const deployments = generateSyntheticDeployments(10);
    const prismaClient = new FakeEvaluationPrismaClient();

    // A deliberately extreme user rule: reclassify every path as "infra".
    // If classificationRules isn't threaded through, this has no effect
    // and the test below (comparing against a run with no rules) would
    // see identical outcomes.
    const withRule = await runEvaluation(deployments, {
      prismaClient,
      classificationRules: [{ type: "infra", patterns: ["**/*"] }],
    });
    const withoutRule = await runEvaluation(deployments, {
      prismaClient: new FakeEvaluationPrismaClient(),
    });

    // Both runs must still produce finite, well-formed metrics either way.
    expectFiniteMetrics(withRule.conditionB);
    expectFiniteMetrics(withoutRule.conditionB);
    // Forcing every file to "infra" changes the ChangeVector CARF
    // computes for every deployment, which changes the dynamic threshold
    // fed into Condition B — so the two runs' Condition B MTTR should
    // differ (infra carries the tightest, fastest-tripping base
    // threshold/window in DEFAULT_CONFIG).
    expect(withRule.conditionB.truePositiveMttrMs).not.toBe(withoutRule.conditionB.truePositiveMttrMs);
  });
});

describe("writeReport", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("writes a human-readable markdown report with both conditions side by side", async () => {
    dir = mkdtempSync(join(tmpdir(), "carf-eval-report-"));
    const outputPath = join(dir, "report.md");

    const deployments = generateSyntheticDeployments(20);
    const prismaClient = new FakeEvaluationPrismaClient();
    const results = await runEvaluation(deployments, { prismaClient });

    const markdown = writeReport(results, outputPath);
    const written = readFileSync(outputPath, "utf-8");

    expect(written).toBe(markdown);
    expect(markdown).toContain("Condition A (static)");
    expect(markdown).toContain("Condition B (CARF dynamic)");
    expect(markdown).toContain("False positive rate");
    expect(markdown).toContain("Precision");
    expect(markdown).toContain("Recall");
    expect(markdown).toContain("True-positive MTTR");
  });
});
