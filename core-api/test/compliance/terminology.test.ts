import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, join } from "node:path";

function getFilesRecursively(dir: string, fileList: string[] = []): string[] {
  if (!dir) return fileList;
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        if (
          entry === "node_modules" ||
          entry === ".git" ||
          entry === ".next" ||
          entry === "dist" ||
          entry === "build" ||
          entry === ".turbo" ||
          entry === "coverage"
        ) {
          continue;
        }
        getFilesRecursively(fullPath, fileList);
      } else {
        fileList.push(fullPath);
      }
    }
  } catch {
    // Skip unreadable directories
  }
  return fileList;
}

const ROOT_DIR = resolve(process.cwd(), "..");

describe("Monorepo Terminology and Compliance Policy", () => {
  const allFiles: string[] = [
    resolve(ROOT_DIR, "README.md"),
    resolve(ROOT_DIR, "docs/TESTING_GUIDE.md"),
    resolve(ROOT_DIR, "docs/DATABASE_MIGRATIONS.md"),
    ...getFilesRecursively(resolve(ROOT_DIR, "core-api/src")),
    ...getFilesRecursively(resolve(ROOT_DIR, "dashboard/src")),
    ...getFilesRecursively(resolve(ROOT_DIR, "web/src")),
  ];

  it("bans 'error budget' in favor of 'error-rate threshold'", () => {
    const violations: { file: string; line: number; text: string }[] = [];

    for (const filePath of allFiles) {
      if (filePath.endsWith("package-lock.json") || filePath.endsWith(".ico")) continue;
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        if (/error\s+budget/i.test(line)) {
          violations.push({
            file: relative(ROOT_DIR, filePath),
            line: idx + 1,
            text: line.trim(),
          });
        }
      });
    }

    expect(
      violations,
      `Found banned term 'error budget' (use 'error-rate threshold' instead):\n${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });

  it("bans 'autonomous' in favor of 'automated' / 'automatic'", () => {
    const violations: { file: string; line: number; text: string }[] = [];

    for (const filePath of allFiles) {
      if (filePath.endsWith("package-lock.json") || filePath.endsWith(".ico")) continue;
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        if (/autonomous/i.test(line)) {
          violations.push({
            file: relative(ROOT_DIR, filePath),
            line: idx + 1,
            text: line.trim(),
          });
        }
      });
    }

    expect(
      violations,
      `Found banned term 'autonomous' (use 'automated' or 'automatic' instead):\n${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });

  it("bans claiming Argo, Flagger, Kubernetes, or Docker as supported standalone integrations", () => {
    const violations: { file: string; line: number; text: string }[] = [];

    // PM2 is the ONLY supported standalone runtime adapter.
    // Preserves citations (e.g. comparing against static Argo/Flagger threshold defaults or research papers).
    const bannedPatterns = [
      /supported\s+(standalone\s+)?(adapter|runtime|integration).*?(kubernetes|k8s|docker|argo|flagger)/i,
      /(kubernetes|k8s|docker|argo|flagger).*?supported\s+(standalone\s+)?(adapter|runtime|integration)/i,
    ];

    for (const filePath of allFiles) {
      if (filePath.endsWith("package-lock.json") || filePath.endsWith(".ico")) continue;
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        for (const pattern of bannedPatterns) {
          if (pattern.test(line)) {
            violations.push({
              file: relative(ROOT_DIR, filePath),
              line: idx + 1,
              text: line.trim(),
            });
          }
        }
      });
    }

    expect(
      violations,
      `Found invalid claim of non-PM2 supported standalone integration:\n${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });
});
