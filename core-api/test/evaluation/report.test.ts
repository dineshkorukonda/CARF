import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_REPORT_PATH, writeReport } from "../../src/evaluation/report.js";
import type { EvalMetrics } from "../../src/evaluation/runHarness.js";

// writeReport is the only artifact a human reads after `npm run evaluate`. A formatting or
// column-ordering slip here misreports the H1 result without failing anything.

function metrics(overrides: Partial<EvalMetrics> = {}): EvalMetrics {
  return {
    falsePositiveRate: 0.1,
    precision: 0.9,
    recall: 0.8,
    truePositiveMttrMs: 1234.6,
    ...overrides,
  } as EvalMetrics;
}

const tempDirs: string[] = [];

function tempPath(name = "report.md"): string {
  const dir = mkdtempSync(join(tmpdir(), "carf-report-"));
  tempDirs.push(dir);
  return join(dir, name);
}

afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

describe("writeReport", () => {
  it("writes the markdown to the given path and returns the same string", () => {
    const path = tempPath();

    const returned = writeReport({ conditionA: metrics(), conditionB: metrics() }, path);

    expect(readFileSync(path, "utf-8")).toBe(returned);
  });

  it("creates missing parent directories", () => {
    const path = join(tempPath("unused"), "..", "nested", "deeper", "report.md");

    writeReport({ conditionA: metrics(), conditionB: metrics() }, path);

    expect(readFileSync(path, "utf-8")).toContain("CARF Synthetic Evaluation Report");
  });

  it("formats rates as percentages to two decimal places", () => {
    const markdown = writeReport(
      { conditionA: metrics({ falsePositiveRate: 0.1234 }), conditionB: metrics({ falsePositiveRate: 0 }) },
      tempPath()
    );

    expect(markdown).toContain("12.34%");
    expect(markdown).toContain("0.00%");
  });

  it("rounds MTTR to whole milliseconds", () => {
    const markdown = writeReport(
      { conditionA: metrics({ truePositiveMttrMs: 1234.6 }), conditionB: metrics({ truePositiveMttrMs: 0 }) },
      tempPath()
    );

    expect(markdown).toContain("1235ms");
    expect(markdown).toContain("0ms");
  });

  // Condition A is the static baseline and Condition B is CARF. Swapping the columns would
  // invert the reported conclusion while every number stayed individually correct.
  it("puts condition A in the static column and condition B in the dynamic column", () => {
    const markdown = writeReport(
      { conditionA: metrics({ precision: 0.11 }), conditionB: metrics({ precision: 0.99 }) },
      tempPath()
    );

    const precisionRow = markdown.split("\n").find((line) => line.startsWith("| Precision"))!;
    expect(precisionRow).toBe("| Precision | 11.00% | 99.00% |");
    expect(markdown).toContain("| Metric | Condition A (static) | Condition B (CARF dynamic) |");
  });

  it("reports every metric the harness produces", () => {
    const markdown = writeReport({ conditionA: metrics(), conditionB: metrics() }, tempPath());

    for (const row of ["False positive rate", "Precision", "Recall", "True-positive MTTR"]) {
      expect(markdown).toContain(`| ${row} |`);
    }
  });

  it("defaults to the package-relative eval-results path", () => {
    expect(DEFAULT_REPORT_PATH).toBe("eval-results/report.md");
  });
});
