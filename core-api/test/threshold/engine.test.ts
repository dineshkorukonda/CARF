import { describe, expect, it } from "vitest";
import type { ChangeVector } from "../../src/classifier/vector.js";
import { computeThreshold, DEFAULT_CONFIG, type ThresholdConfig } from "../../src/threshold/engine.js";

function vector(overrides: Partial<ChangeVector> = {}): ChangeVector {
  return {
    infra: 0,
    dependency: 0,
    config: 0,
    code: 0,
    data: 0,
    code_complexity: 0,
    ...overrides,
  };
}

// Simple, hand-checkable config used by most tests so expected numbers are easy to verify.
const TEST_CONFIG: ThresholdConfig = {
  baseThreshold: { infra: 0.01, dependency: 0.03, config: 0.05, code: 0.08, data: 0.01 },
  baseWindow: { infra: 60, dependency: 180, config: 300, code: 900, data: 600 },
  decay: 0.5,
  complexityDecay: 0.3,
};

describe("computeThreshold", () => {
  it("returns the exact decayed contribution for a single active type", () => {
    const result = computeThreshold(vector({ config: 1.0 }), TEST_CONFIG);

    // contribution = 0.05 * (1 - 0.5 * 1.0) = 0.025
    expect(result.finalThreshold).toBeCloseTo(0.025, 10);
    // window = 300 * (1 - 0.5 * 1.0) = 150
    expect(result.finalWindow).toBeCloseTo(150, 10);
    expect(result.activeTypes).toEqual(["config"]);
  });

  it("returns the exact decayed contribution for a different single active type (infra)", () => {
    const result = computeThreshold(vector({ infra: 0.4 }), TEST_CONFIG);

    // contribution = 0.01 * (1 - 0.5 * 0.4) = 0.01 * 0.8 = 0.008
    expect(result.finalThreshold).toBeCloseTo(0.008, 10);
    // window = 60 * 0.8 = 48
    expect(result.finalWindow).toBeCloseTo(48, 10);
    expect(result.activeTypes).toEqual(["infra"]);
  });

  it("returns the MIN (strictest) contribution across multiple active types", () => {
    // infra contribution: 0.01 * (1 - 0.5*0.2) = 0.01 * 0.9 = 0.009
    // dependency contribution: 0.03 * (1 - 0.5*0.5) = 0.03 * 0.75 = 0.0225
    // config contribution: 0.05 * (1 - 0.5*1.0) = 0.025
    // code contribution: 0.08 * (1 - 0.5*0.1) = 0.08 * 0.95 = 0.076
    // min threshold contribution -> infra (0.009)
    const v = vector({ infra: 0.2, dependency: 0.5, config: 1.0, code: 0.1 });
    const result = computeThreshold(v, TEST_CONFIG);

    expect(result.finalThreshold).toBeCloseTo(0.009, 10);

    // window contributions:
    // infra: 60 * 0.9 = 54
    // dependency: 180 * 0.75 = 135
    // config: 300 * 0.5 = 150
    // code: 900 * 0.95 = 855
    // min window -> infra (54)
    expect(result.finalWindow).toBeCloseTo(54, 10);

    expect(result.activeTypes.sort()).toEqual(["code", "config", "dependency", "infra"].sort());
  });

  it("picks the min threshold and min window independently even when different types are strictest for each", () => {
    // Craft a case where the type with the min threshold contribution differs from the
    // type with the min window contribution.
    const config: ThresholdConfig = {
      baseThreshold: { infra: 0.5, dependency: 0.01, config: 0.05, code: 0.08, data: 0.01 },
      baseWindow: { infra: 60, dependency: 5000, config: 300, code: 900, data: 600 },
      decay: 0.5,
      complexityDecay: 0.3,
    };
    // infra: threshold 0.5*(1-0.5*1)=0.25, window 60*(1-0.5*1)=30
    // dependency: threshold 0.01*(1-0.5*1)=0.005, window 5000*(1-0.5*1)=2500
    const v = vector({ infra: 1, dependency: 1 });
    const result = computeThreshold(v, config);

    expect(result.finalThreshold).toBeCloseTo(0.005, 10); // dependency wins threshold
    expect(result.finalWindow).toBeCloseTo(30, 10); // infra wins window
  });

  it("multiplies finalThreshold down by the complexity penalty factor when code_complexity > 0", () => {
    const v = vector({ config: 1.0, code_complexity: 0.5 });
    const result = computeThreshold(v, TEST_CONFIG);

    // base contribution = 0.025 (as above)
    // penalty = 1 - 0.3 * 0.5 = 0.85
    expect(result.finalThreshold).toBeCloseTo(0.025 * 0.85, 10);
    // window is unaffected by complexity
    expect(result.finalWindow).toBeCloseTo(150, 10);
  });

  it("leaves finalThreshold untouched when code_complexity == 0", () => {
    const v = vector({ config: 1.0, code_complexity: 0 });
    const result = computeThreshold(v, TEST_CONFIG);

    expect(result.finalThreshold).toBeCloseTo(0.025, 10);
  });

  it("does not throw on an all-zero vector and returns the documented safe default", () => {
    const result = computeThreshold(vector(), TEST_CONFIG);

    expect(() => computeThreshold(vector(), TEST_CONFIG)).not.toThrow();
    // Safe default: no active types means nothing should ever trigger a rollback off
    // this commit alone, so we surface Infinity/Infinity with an empty activeTypes list
    // rather than a fabricated numeric threshold. See engine.ts doc comment.
    expect(result.finalThreshold).toBe(Infinity);
    expect(result.finalWindow).toBe(Infinity);
    expect(result.activeTypes).toEqual([]);
  });

  it("ignores code_complexity on an all-zero vector (still returns the safe default, no throw)", () => {
    const result = computeThreshold(vector({ code_complexity: 0.9 }), TEST_CONFIG);

    expect(result.finalThreshold).toBe(Infinity);
    expect(result.finalWindow).toBe(Infinity);
    expect(result.activeTypes).toEqual([]);
  });

  it("uses DEFAULT_CONFIG when no config argument is supplied", () => {
    const result = computeThreshold(vector({ code: 1.0 }));

    const expectedThreshold = DEFAULT_CONFIG.baseThreshold.code * (1 - DEFAULT_CONFIG.decay * 1.0);
    const expectedWindow = DEFAULT_CONFIG.baseWindow.code * (1 - DEFAULT_CONFIG.decay * 1.0);
    expect(result.finalThreshold).toBeCloseTo(expectedThreshold, 10);
    expect(result.finalWindow).toBeCloseTo(expectedWindow, 10);
  });

  it("DEFAULT_CONFIG matches the documented window ordering: infra < dependency < config < code", () => {
    expect(DEFAULT_CONFIG.baseWindow.infra).toBe(60);
    expect(DEFAULT_CONFIG.baseWindow.dependency).toBe(180);
    expect(DEFAULT_CONFIG.baseWindow.config).toBe(300);
    expect(DEFAULT_CONFIG.baseWindow.code).toBe(900);
  });

  it("DEFAULT_CONFIG matches the documented threshold ordering: infra tightest, code most permissive", () => {
    const { infra, dependency, config, code } = DEFAULT_CONFIG.baseThreshold;
    expect(infra).toBeLessThan(dependency);
    expect(dependency).toBeLessThan(config);
    expect(config).toBeLessThan(code);
  });

  it("only includes types with vector value > 0 in activeTypes (a zero-valued type among others is excluded)", () => {
    const v = vector({ infra: 0, dependency: 0.3, config: 0, code: 0 });
    const result = computeThreshold(v, TEST_CONFIG);

    expect(result.activeTypes).toEqual(["dependency"]);
    // dependency contribution: 0.03 * (1 - 0.5*0.3) = 0.03 * 0.85 = 0.0255
    expect(result.finalThreshold).toBeCloseTo(0.0255, 10);
  });
});
