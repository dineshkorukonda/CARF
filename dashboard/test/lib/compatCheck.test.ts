import { describe, expect, it } from "vitest";
import { evaluateCompatibility } from "../../src/lib/compatCheck";

describe("evaluateCompatibility", () => {
  it("recommends standalone/pm2 when PM2 ecosystem is present", () => {
    const report = evaluateCompatibility(["ecosystem.config.cjs", "src/index.ts"]);

    expect(report.recommendedMode).toBe("standalone");
    expect(report.recommendedAdapter).toBe("pm2");
    expect(report.signals.find((s) => s.id === "pm2")?.matched).toBe(true);
  });

  it("recommends augment when Argo Rollouts manifests are present", () => {
    const report = evaluateCompatibility([".github/workflows/deploy.yaml", "rollouts/app-rollout.yaml"]);

    expect(report.recommendedMode).toBe("augment");
    expect(report.signals.find((s) => s.id === "argoRollouts")?.matched).toBe(true);
  });

  it("recommends either when both PM2 and Argo Rollouts are present", () => {
    const report = evaluateCompatibility(["ecosystem.config.js", "argo/rollout.yaml"]);

    expect(report.recommendedMode).toBe("either");
  });

  it("falls back to unclear with no matching signals", () => {
    const report = evaluateCompatibility(["README.md", "src/index.ts"]);

    expect(report.recommendedMode).toBe("unclear");
    expect(report.recommendedAdapter).toBeUndefined();
    expect(report.signals.every((s) => !s.matched)).toBe(true);
  });
});
