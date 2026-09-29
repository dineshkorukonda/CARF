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
  it("walks the default engine to the ~2.87% ceiling and ~296s window", () => {
    const walk = explainThreshold(sahaayProbe, {
      finalThreshold: 0.0287,
      finalWindow: 296,
      activeTypes: ["config", "code"],
    });
    expect(walk.strictestType).toBe("code");
    expect(walk.reconstructedThreshold).toBeCloseTo(0.02884, 4);
    expect(Math.round(walk.reconstructedWindow)).toBe(296);
    expect(walk.ceilingWhy).toMatch(/2\.88%/);
    expect(walk.windowWhy).toMatch(/shortest window/);
    expect(walk.activeWhy).toMatch(/config, code/);
  });
});

describe("explainComplexity", () => {
  it("explains a ceiling score as raw complexity at or above 50", () => {
    const detail = explainComplexity(1);
    expect(detail.scoreOutOf100).toBe(100);
    expect(detail.why).toMatch(/ceiling/);
    expect(detail.steps.length).toBe(4);
  });
});

describe("explainMix", () => {
  it("explains zero vs non-zero shares", () => {
    const mix = explainMix(sahaayProbe);
    expect(mix.find((m) => m.key === "infra")?.why).toMatch(/0%/);
    expect(mix.find((m) => m.key === "code")?.why).toMatch(/97%/);
  });
});
