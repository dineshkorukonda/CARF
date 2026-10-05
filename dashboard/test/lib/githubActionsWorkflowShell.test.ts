import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";
import { renderCarfWorkflow } from "../../src/lib/githubActionsWorkflow";

const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "/bin/bash";
const parsed = load(renderCarfWorkflow({ coreApiUrl: "https://carf.example.com", branch: "main", managedPm2: true })) as { jobs: Record<string, { steps: Array<{ name: string; run: string }> }> };
const steps = parsed.jobs["carf-deploy"]!.steps;

describe.skipIf(!existsSync(bash))("generated deployment Bash", () => {
  it("treats a branch-tip race as superseded instead of a failed deployment", () => {
    const root = mkdtempSync(join(tmpdir(), "carf-superseded-"));
    try {
      const fixtures = `curl() { printf 409; }\njq() { if [ "$1" = "-n" ]; then printf '{}'; else printf SUPERSEDED; fi; }\n`;
      const result = spawnSync(bash, [], { cwd: root, input: fixtures + steps.find((step) => step.name === "Deploy exact commit with CARF and PM2")!.run, encoding: "utf8", timeout: 3000, env: { ...process.env, CARF_API_URL: "https://carf.example.com", CARF_API_KEY: "fixture", CARF_OWNER: "acme", CARF_REPO: "app", CARF_BRANCH: "main", CARF_SHA: "a".repeat(40), CARF_CI_RUN_ID: "42", GITHUB_OUTPUT: "outputs.txt", GITHUB_STEP_SUMMARY: "summary.txt" } });
      expect(result.status).toBe(0);
      expect(readFileSync(join(root, "outputs.txt"), "utf8")).toContain("superseded=true");
      expect(readFileSync(join(root, "summary.txt"), "utf8")).toContain("Superseded");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it("hands a required rollback to a separate job", () => {
    const fixtures = `curl() { printf 200; }\njq() { if [ "$2" = ".status" ]; then printf ROLLBACK_REQUIRED; else printf rollout-123; fi; }\nsleep() { :; }\n`;
    const root = mkdtempSync(join(tmpdir(), "carf-workflow-"));
    try {
      const result = spawnSync(bash, [], { cwd: root, input: fixtures + steps.find((step) => step.name === "Wait for observation and rollback decision")!.run, encoding: "utf8", timeout: 3000, env: { ...process.env, CARF_API_URL: "https://carf.example.com", CARF_API_KEY: "fixture", CARF_OWNER: "acme", CARF_REPO: "app", CARF_SHA: "a".repeat(40), GITHUB_OUTPUT: "outputs.txt" } });
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(readFileSync(join(root, "outputs.txt"), "utf8")).toContain("rollback_id=rollout-123");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
    expect(parsed.jobs["carf-rollback"]!.steps[0]!.run).toContain('--data \'{"automatic":true}\'');
  });
  it.each(Object.values(parsed.jobs).flatMap((job) => job.steps))("parses $name with Bash", (step) => {
    const result = spawnSync(bash, ["-n"], { input: step.run, encoding: "utf8" });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
  it.each([{ outcome: "SUCCESS", exit: 0 }, { outcome: "ROLLED_BACK", exit: 1 }, { outcome: "FAILED", exit: 1 }])("reports $outcome as exit $exit", ({ outcome, exit }) => {
    // Replace external services, execute the actual generated observation script.
    const fixtures = `curl() { printf 200; }\njq() { if [ "$2" = ".status" ]; then printf '%s' "$FIXTURE_OUTCOME"; else printf 'fixture decision'; fi; }\nsleep() { :; }\n`;
    const result = spawnSync(bash, [], { input: fixtures + steps.find((step) => step.name === "Wait for observation and rollback decision")!.run, encoding: "utf8", timeout: 3000, env: { ...process.env, CARF_API_URL: "https://carf.example.com", CARF_API_KEY: "fixture", CARF_OWNER: "acme", CARF_REPO: "app", CARF_SHA: "a".repeat(40), FIXTURE_OUTCOME: outcome } });
    expect(result.status).toBe(exit);
    expect(result.stdout).toContain(outcome === "SUCCESS" ? "healthy" : "fixture decision");
  });
});
