import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "/bin/bash";
const action = load(readFileSync(fileURLToPath(new URL("../../../.github/actions/carf-threshold/action.yml", import.meta.url)), "utf8")) as {
  inputs: Record<string, { default?: string }>;
  runs: { steps: Array<{ run: string }> };
};

describe.skipIf(!existsSync(bash))("threshold action shell integration", () => {
  function run(mock: string, fail = "true") {
    const root = mkdtempSync(join(tmpdir(), "carf-pr-action-"));
    try {
      const result = spawnSync(bash, ["--noprofile", "--norc"], {
        cwd: root,
        input: `${mock}\njq() { cat >/dev/null; case "$2" in .finalThreshold) printf 0.01;; .finalWindow) printf 180;; .activeTypes) printf '["code"]';; esac; }\n${action.runs.steps[0]!.run}`,
        encoding: "utf8",
        timeout: 5000,
        env: { ...process.env, CARF_API_URL: "https://carf.example/", CARF_COMMIT: "pr-head", CARF_API_KEY: "test-key", CARF_FAIL_ON_MISSING: fail, GITHUB_OUTPUT: "outputs.txt" },
      });
      return { ...result, stdout: result.stdout + (existsSync(join(root, "outputs.txt")) ? readFileSync(join(root, "outputs.txt"), "utf8") : "") };
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it("selects the PR head and returns policy outputs from an authenticated lookup", () => {
    expect(action.inputs.commit!.default).toBe("${{ github.event.pull_request.head.sha || github.sha }}");
    const result = run(`curl() {
      [[ "$*" == *"commit=pr-head"* && "$*" == *"Authorization: Bearer test-key"* ]] || return 1
      printf '{"finalThreshold":0.01,"finalWindow":180,"activeTypes":["code"]}\\n200'
    }`);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("found=true");
    expect(result.stdout).toContain("final-threshold=0.01");
    expect(result.stdout).toContain("final-window=180");
  });

  it("bounds missing-policy retries and respects fail-on-missing", () => {
    const result = run(`curl() { printf '{}\\n404'; }
      sleep() { echo retry >&2; }`, "false");
    expect(result.status).toBe(0);
    expect(result.stderr.match(/retry/g)).toHaveLength(5);
    expect(result.stdout).toContain("found=false");
  });

  it("fails immediately on an authentication error", () => {
    const result = run(`curl() { printf '{}\\n401'; }
      sleep() { echo unexpected-retry >&2; }`);
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain("unexpected-retry");
    expect(result.stdout).toContain("HTTP 401");
  });
});
