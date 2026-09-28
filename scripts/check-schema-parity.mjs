#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, "..");

// Format both schemas first to ensure canonical column alignment
try {
  execSync("npx prisma format", { cwd: resolve(ROOT_DIR, "core-api"), stdio: "ignore" });
  execSync("npx prisma format", { cwd: resolve(ROOT_DIR, "dashboard"), stdio: "ignore" });
} catch (err) {
  // If prisma format cannot execute in this environment, continue to content check
}

function stripCommentsAndNormalize(content) {
  return content
    .split(/\r?\n/)
    .map((line) => {
      const commentIndex = line.indexOf("//");
      const withoutComment = commentIndex !== -1 ? line.slice(0, commentIndex) : line;
      return withoutComment.trimEnd();
    })
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

const corePath = resolve(ROOT_DIR, "core-api/prisma/schema.prisma");
const dashboardPath = resolve(ROOT_DIR, "dashboard/prisma/schema.prisma");

const coreContent = readFileSync(corePath, "utf-8");
const dashboardContent = readFileSync(dashboardPath, "utf-8");

const normalizedCore = stripCommentsAndNormalize(coreContent);
const normalizedDashboard = stripCommentsAndNormalize(dashboardContent);

if (normalizedCore !== normalizedDashboard) {
  console.error("Schema parity check FAILED: core-api/prisma/schema.prisma and dashboard/prisma/schema.prisma do not match!");

  const coreLines = normalizedCore.split("\n");
  const dashLines = normalizedDashboard.split("\n");
  const maxLines = Math.max(coreLines.length, dashLines.length);

  for (let i = 0; i < maxLines; i++) {
    const c = coreLines[i] ?? "<EOF>";
    const d = dashLines[i] ?? "<EOF>";
    if (c !== d) {
      console.error(`Difference at line ${i + 1}:`);
      console.error(`  core-api:  ${c}`);
      console.error(`  dashboard: ${d}`);
      break;
    }
  }
  process.exit(1);
} else {
  console.log("Schema parity check PASSED: core-api and dashboard Prisma schemas are identical (excluding comments).");
}
