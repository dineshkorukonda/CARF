import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("runs the CLI from paths containing spaces and fails unsuccessful verification", () => {
  const dir = mkdtempSync(join(tmpdir(), "carf agent cli "));
  const script = join(dir, "agent.mjs");
  copyFileSync(fileURLToPath(new URL("../agent.mjs", import.meta.url)), script);
  const options = { cwd: dir, encoding: "utf8" as const, env: {
    ...process.env, PATH: dir, HOME: dir, USERPROFILE: dir, CARF_INSTALL_TOKEN: "",
  } };
  const help = spawnSync(process.execPath, [script, "--help"], options);
  expect(help.status).toBe(0);
  expect(help.stdout).toContain("Usage:");
  const verify = spawnSync(process.execPath, [script, "--verify"], options);
  expect(verify.status).toBe(1);
  expect(verify.stdout).toContain("warnings/failures");
});
