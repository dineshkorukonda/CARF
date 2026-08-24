import { describe, expect, it } from "vitest";
import { mergeThresholdConfig } from "../../src/config/mergeThresholdConfig.js";
import { DEFAULT_CONFIG } from "../../src/threshold/engine.js";

describe("mergeThresholdConfig", () => {
  it("returns DEFAULT_CONFIG unchanged when userThreshold is undefined", () => {
    expect(mergeThresholdConfig(undefined)).toEqual(DEFAULT_CONFIG);
  });

  it("returns DEFAULT_CONFIG unchanged when userThreshold is an empty object", () => {
    expect(mergeThresholdConfig({})).toEqual(DEFAULT_CONFIG);
  });

  it("overrides decay and complexityDecay scalars", () => {
    const result = mergeThresholdConfig({ decay: 0.6, complexityDecay: 0.9 });
    expect(result.decay).toBe(0.6);
    expect(result.complexityDecay).toBe(0.9);
    expect(result.baseThreshold).toEqual(DEFAULT_CONFIG.baseThreshold);
    expect(result.baseWindow).toEqual(DEFAULT_CONFIG.baseWindow);
  });

  it("overrides only the specified field of a type, keeping the other field's default", () => {
    const result = mergeThresholdConfig({
      types: { infra: { baseThreshold: 0.02 } },
    });
    expect(result.baseThreshold.infra).toBe(0.02);
    expect(result.baseWindow.infra).toBe(DEFAULT_CONFIG.baseWindow.infra); // unspecified, kept
    expect(result.baseThreshold.dependency).toBe(DEFAULT_CONFIG.baseThreshold.dependency); // untouched type
  });

  it("overrides multiple types independently", () => {
    const result = mergeThresholdConfig({
      types: {
        infra: { baseThreshold: 0.02, baseWindow: 45 },
        code: { baseWindow: 1200 },
      },
    });
    expect(result.baseThreshold.infra).toBe(0.02);
    expect(result.baseWindow.infra).toBe(45);
    expect(result.baseWindow.code).toBe(1200);
    expect(result.baseThreshold.code).toBe(DEFAULT_CONFIG.baseThreshold.code); // unspecified, kept
    expect(result.baseThreshold.config).toBe(DEFAULT_CONFIG.baseThreshold.config); // untouched type
  });

  it("accepts an explicit base config other than DEFAULT_CONFIG", () => {
    const customBase = {
      baseThreshold: { infra: 1, dependency: 1, config: 1, code: 1 },
      baseWindow: { infra: 1, dependency: 1, config: 1, code: 1 },
      decay: 1,
      complexityDecay: 1,
    };
    const result = mergeThresholdConfig({ decay: 0.5 }, customBase);
    expect(result.decay).toBe(0.5);
    expect(result.baseThreshold).toEqual(customBase.baseThreshold);
  });
});
