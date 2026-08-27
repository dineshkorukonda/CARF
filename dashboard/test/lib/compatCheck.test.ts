import { describe, expect, it } from "vitest";
import { evaluateCompatibility } from "../../src/lib/compatCheck";

describe("evaluateCompatibility", () => {
  it("recommends standalone/kubernetes when k8s manifests are present", () => {
    const report = evaluateCompatibility(["k8s/deployment.yaml", "src/index.ts"]);

    expect(report.recommendedMode).toBe("standalone");
    expect(report.recommendedAdapter).toBe("kubernetes");
    expect(report.signals.find((s) => s.id === "kubernetes")?.matched).toBe(true);
  });

  it("recommends augment when Argo Rollouts manifests are present", () => {
    const report = evaluateCompatibility([".github/workflows/deploy.yaml", "rollouts/app-rollout.yaml"]);

    expect(report.recommendedMode).toBe("augment");
    expect(report.signals.find((s) => s.id === "argoRollouts")?.matched).toBe(true);
  });

  it("recommends either when both a standalone target and Flagger are present", () => {
    const report = evaluateCompatibility(["docker-compose.yaml", "flagger/canary.yaml"]);

    expect(report.recommendedMode).toBe("either");
  });

  it("falls back to unclear with no matching signals", () => {
    const report = evaluateCompatibility(["README.md", "src/index.ts"]);

    expect(report.recommendedMode).toBe("unclear");
    expect(report.recommendedAdapter).toBeUndefined();
    expect(report.signals.every((s) => !s.matched)).toBe(true);
  });
});
