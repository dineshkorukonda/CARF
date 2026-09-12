import { describe, expect, it } from "vitest";
import { classifyRolloutOutcome } from "../../src/lib/outcomeClassifier";

describe("classifyRolloutOutcome", () => {
  it("returns 'no_signal' when no types and no threshold exist", () => {
    const res = classifyRolloutOutcome({
      finalThreshold: null,
      activeTypes: [],
      rolledBack: null,
      finalErrorRate: null,
    });
    expect(res.kind).toBe("no_signal");
    expect(res.label).toBe("No signal");
  });

  it("returns 'no_signal' when threshold is Infinity", () => {
    const res = classifyRolloutOutcome({
      finalThreshold: Infinity,
      activeTypes: ["code"],
      rolledBack: null,
      finalErrorRate: null,
    });
    expect(res.kind).toBe("no_signal");
  });

  it("returns 'healthy' when rolledBack is false", () => {
    const res = classifyRolloutOutcome({
      finalThreshold: 0.05,
      activeTypes: ["code"],
      rolledBack: false,
      finalErrorRate: 0.001,
    });
    expect(res.kind).toBe("healthy");
    expect(res.label).toBe("Healthy");
  });

  it("returns 'rolled_back' when rolledBack is true", () => {
    const res = classifyRolloutOutcome({
      finalThreshold: 0.05,
      activeTypes: ["code"],
      rolledBack: true,
      finalErrorRate: 0.09,
    });
    expect(res.kind).toBe("rolled_back");
    expect(res.label).toBe("Rolled back");
    expect(res.errorRate).toBe(0.09);
  });

  it("returns 'pending' when threshold exists but no outcome row was written yet", () => {
    const res = classifyRolloutOutcome({
      finalThreshold: 0.05,
      activeTypes: ["config"],
      rolledBack: null,
      finalErrorRate: null,
    });
    expect(res.kind).toBe("pending");
    expect(res.label).toBe("Pending / Augment");
  });
});
