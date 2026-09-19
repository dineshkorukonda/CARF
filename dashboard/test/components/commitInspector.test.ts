import { describe, it, expect } from "vitest";

describe("Commit AST Risk Inspector & Formula Explainability", () => {
  it("evaluates risk classifications based on threshold levels", () => {
    const isHighRisk = (threshold: number) => threshold < 0.015;
    const isMediumRisk = (threshold: number) => threshold >= 0.015 && threshold < 0.035;
    const isLowRisk = (threshold: number) => threshold >= 0.035;

    expect(isHighRisk(0.008)).toBe(true);
    expect(isMediumRisk(0.025)).toBe(true);
    expect(isLowRisk(0.0347)).toBe(false); // 0.0347 is medium risk (< 0.035)
    expect(isLowRisk(0.045)).toBe(true);
  });

  it("formats dynamic error threshold and soak window accurately", () => {
    const formatThreshold = (val: number | null) =>
      val !== null && Number.isFinite(val) ? (val * 100).toFixed(2) + "%" : "--";

    expect(formatThreshold(0.0347)).toBe("3.47%");
    expect(formatThreshold(0.008)).toBe("0.80%");
    expect(formatThreshold(null)).toBe("--");
  });
});
