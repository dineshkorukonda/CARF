import { describe, expect, it } from "vitest";
import { DEFAULT_SIMULATION_SEED, DEMO_BASE_THRESHOLDS, runSimulation } from "../../src/lib/evalHarness";

describe("runSimulation", () => {
  it("computes Condition A and Condition B metrics from synthetic traces", async () => {
    const res = await runSimulation(50);
    expect(res.totalRuns).toBe(50);
    expect(res.conditionA).toBeDefined();
    expect(res.conditionB).toBeDefined();
    expect(res.evaluationKind).toBe("synthetic-computed");
    expect(res.usesProductionClassifier).toBe(false);
    expect(res.usesProductionThresholdTable).toBe(true);
    expect(res.mttrIsSynthetic).toBe(true);
    expect(res.seed).toBe(DEFAULT_SIMULATION_SEED);
    expect(res.traces).toHaveLength(50);
    expect(res.traces.every((t) => typeof t.peakErrorRate === "number")).toBe(true);

    // Condition B (CARF Dynamic) should show lower FPR than Condition A (Static Canary)
    expect(res.conditionB.falsePositiveRate).toBeLessThan(res.conditionA.falsePositiveRate);

    // Condition B should achieve faster MTTR than Condition A
    expect(res.conditionB.truePositiveMttrMs).toBeLessThan(res.conditionA.truePositiveMttrMs);
  });

  it("is deterministic for a fixed seed and uses the production base table", async () => {
    const a = await runSimulation(50, 42);
    const b = await runSimulation(50, 42);
    expect(a.conditionA).toEqual(b.conditionA);
    expect(a.conditionB).toEqual(b.conditionB);
    expect(a.traces.map((t) => t.thresholdB)).toEqual(b.traces.map((t) => t.thresholdB));

    const configTrace = a.traces.find((t) => t.changeType === "config");
    if (configTrace) {
      expect(configTrace.thresholdB).toBe(DEMO_BASE_THRESHOLDS.config);
    }
    const infraTrace = a.traces.find((t) => t.changeType === "infra");
    if (infraTrace) {
      expect(infraTrace.thresholdB).toBe(DEMO_BASE_THRESHOLDS.infra);
    }
  });
});
