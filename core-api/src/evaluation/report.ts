import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { EvalMetrics } from "./runHarness.js";

/** Relative to the `core-api/` package root — where `npm run evaluate` is run from. */
export const DEFAULT_REPORT_PATH = "eval-results/report.md";

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatMs(value: number): string {
  return `${Math.round(value)}ms`;
}

/**
 * Renders a side-by-side Condition A (static) vs. Condition B (CARF dynamic) markdown
 * report and writes it to `outputPath` (default: core-api/eval-results/report.md),
 * creating parent directories as needed. Returns the markdown so callers (tests, the
 * `npm run evaluate` CLI) can inspect it without re-reading the file.
 */
export function writeReport(
  results: { conditionA: EvalMetrics; conditionB: EvalMetrics },
  outputPath: string = DEFAULT_REPORT_PATH
): string {
  const { conditionA, conditionB } = results;

  const markdown = [
    "# CARF Synthetic Evaluation Report",
    "",
    "H1: does CARF's per-change-type dynamic threshold outperform a single static",
    "threshold (matching common Argo Rollouts/Flagger canary defaults) on the same",
    "synthetic deployment dataset?",
    "",
    "| Metric | Condition A (static) | Condition B (CARF dynamic) |",
    "| --- | --- | --- |",
    `| False positive rate | ${formatPercent(conditionA.falsePositiveRate)} | ${formatPercent(conditionB.falsePositiveRate)} |`,
    `| Precision | ${formatPercent(conditionA.precision)} | ${formatPercent(conditionB.precision)} |`,
    `| Recall | ${formatPercent(conditionA.recall)} | ${formatPercent(conditionB.recall)} |`,
    `| True-positive MTTR | ${formatMs(conditionA.truePositiveMttrMs)} | ${formatMs(conditionB.truePositiveMttrMs)} |`,
    "",
  ].join("\n");

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, markdown, "utf-8");

  return markdown;
}
