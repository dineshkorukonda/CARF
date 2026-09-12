import { describe, expect, it } from "vitest";
import { runSimulation } from "../../src/lib/evalHarness";

describe("runSimulation", () => {
  it("produces valid Condition A and Condition B metrics", async () => {
    const res = await runSimulation(50);
    expect(res.totalRuns).toBe(50);
    expect(res.conditionA).toBeDefined();
    expect(res.conditionB).toBeDefined();

    // Condition B (CARF Dynamic) should show lower FPR than Condition A (Static Canary)
    expect(res.conditionB.falsePositiveRate).toBeLessThan(res.conditionA.falsePositiveRate);

    // Condition B should achieve faster MTTR than Condition A
    expect(res.conditionB.truePositiveMttrMs).toBeLessThan(res.conditionA.truePositiveMttrMs);
  });
});
