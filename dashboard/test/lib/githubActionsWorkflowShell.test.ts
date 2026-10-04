import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";
import { renderCarfWorkflow } from "../../src/lib/githubActionsWorkflow";

const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "/bin/bash";
const parsed = load(renderCarfWorkflow({ coreApiUrl: "https://carf.example.com", branch: "main", managedPm2: true })) as { jobs: Record<string, { steps: Array<{ name: string; run: string }> }> };
const steps = parsed.jobs["carf-deploy"]!.steps;

describe.skipIf(!existsSync(bash))("generated deployment Bash", () => {
  it.each(steps)("parses $name with Bash", (step) => {
    const result = spawnSync(bash, ["-n"], { input: step.run, encoding: "utf8" });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
  it.each([{ outcome: "SUCCESS", exit: 0 }, { outcome: "ROLLED_BACK", exit: 1 }, { outcome: "FAILED", exit: 1 }])("reports $outcome as exit $exit", ({ outcome, exit }) => {
    // Replace external services, execute the actual generated observation script.
    const fixtures = `curl() { printf 200; }\njq() { if [ "$2" = ".status" ]; then printf '%s' "$FIXTURE_OUTCOME"; else printf 'fixture decision'; fi; }\nsleep() { :; }\n`;
    const result = spawnSync(bash, [], { input: fixtures + steps[2]!.run, encoding: "utf8", timeout: 3000, env: { ...process.env, CARF_API_URL: "https://carf.example.com", CARF_API_KEY: "fixture", CARF_OWNER: "acme", CARF_REPO: "app", CARF_SHA: "a".repeat(40), FIXTURE_OUTCOME: outcome } });
    expect(result.status).toBe(exit);
    expect(result.stdout).toContain(outcome === "SUCCESS" ? "healthy" : "fixture decision");
  });
});
