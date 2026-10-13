import { describe, expect, it } from "vitest";
import { explainComplexity, explainMix, explainThreshold } from "../../src/lib/thresholdExplain";

const sahaayProbe = {
  infra: 0,
  dependency: 0,
  config: 0.03,
  code: 0.97,
  data: 0,
  codeComplexity: 1,
};

describe("explainThreshold", () => {
  it("uses the strictest ceiling and longest active window", () => {
    const walk = explainThreshold(sahaayProbe, {
      finalThreshold: 0.02884,
      finalWindow: 463.5,
      activeTypes: ["config", "code"],
    });
    expect(walk.strictestType).toBe("code");
    expect(walk.reconstructedThreshold).toBeCloseTo(0.02884, 4);
    expect(walk.reconstructedWindow).toBe(463.5);
    expect(walk.ceilingWhy).toMatch(/2\.88%/);
    expect(walk.windowWhy).toMatch(/longest window/);
    expect(walk.activeWhy).toMatch(/config, code/);
    expect(walk.storedMatchesDefaultWalk).toBe(true);
  });

  it("explains the mixed infrastructure/code example without truncating the code window", () => {
    const vector = { infra: 0.5, dependency: 0, config: 0, code: 0.5, data: 0, codeComplexity: 0.07 };
    const walk = explainThreshold(vector, {
      finalThreshold: 0.0073425, finalWindow: 675, activeTypes: ["infra", "code"],
    });
    expect(walk.strictestType).toBe("infra");
    expect(walk.reconstructedThreshold).toBeCloseTo(0.0073425, 8);
    expect(walk.reconstructedWindow).toBe(675);
    expect(walk.storedMatchesDefaultWalk).toBe(true);
  });
});

describe("explainComplexity", () => {
  it("explains a ceiling score as raw complexity at or above 50", () => {
    const detail = explainComplexity(1);
    expect(detail.scoreOutOf100).toBe(100);
    expect(detail.why).toMatch(/ceiling/);
    expect(detail.steps.length).toBe(4);
  });

  it("preserves fractional raw points and distinguishes a near-ceiling score", () => {
    expect(explainComplexity(0.07).why).toContain("3.50 raw points");
    expect(explainComplexity(0.999).why).toContain("49.95 raw points");
  });
});

describe("explainMix", () => {
  it("explains zero vs non-zero shares", () => {
    const mix = explainMix(sahaayProbe);
    expect(mix.find((m) => m.key === "infra")?.why).toMatch(/0%/);
    expect(mix.find((m) => m.key === "code")?.why).toMatch(/97%/);
  });
});
