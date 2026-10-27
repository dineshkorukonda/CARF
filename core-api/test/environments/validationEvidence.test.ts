import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("never presents manifest presence or mocked execution as a live environment test", () => {
  const script = resolve(__dirname, "../../../environments/validate-environments.mjs");
  const results = JSON.parse(execFileSync(process.execPath, [script], { encoding: "utf8" }));
  expect(results).toHaveLength(9);
  expect(results.every((result: { runtimeVerified: boolean; status: string }) =>
    !result.runtimeVerified && result.status === "STATIC-VALIDATED")).toBe(true);
  const live = spawnSync(process.execPath, [script, "--require-live"], { encoding: "utf8" });
  expect(live.status).toBe(1);
});
