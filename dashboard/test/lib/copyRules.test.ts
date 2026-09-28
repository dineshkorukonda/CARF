import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BANNED_PATTERNS = [
  /autonomous rollback/i,
  /zero-human intervention/i,
  /prevented outages/i,
  /watchdogs/i,
  /monitored clean/i,
  /dynamic error budget/i,
];

function scanFiles(dir: string, fileList: string[] = []): string[] {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      scanFiles(fullPath, fileList);
    } else if (/\.(tsx|ts|jsx|js)$/.test(entry) && !entry.includes(".test.") && !entry.includes(".spec.")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe("Copy and Terminology Compliance (No Overclaims)", () => {
  it("ensures no banned marketing phrases exist in dashboard/src/app or components", () => {
    // Scan dashboard source files
    const srcDir = join(process.cwd(), "src");
    const files = scanFiles(srcDir);
    const violations: Array<{ file: string; match: string; line: number }> = [];

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");

      lines.forEach((lineText, idx) => {
        for (const pattern of BANNED_PATTERNS) {
          if (pattern.test(lineText)) {
            violations.push({
              file: file.replace(process.cwd(), ""),
              match: pattern.source,
              line: idx + 1,
            });
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
