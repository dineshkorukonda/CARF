import { describe, expect, it } from "vitest";
import type { ChangeVector } from "../../src/classifier/vector.js";
import { DEFAULT_CONFIG, computeThreshold } from "../../src/threshold/engine.js";

// Regression suite for the threshold engine's numeric guarantees.
//
// .agents/rules/coding.md calls this category "Redundant" tests. These are deliberately
// redundant with test/threshold/: that suite checks the decay formula produces the right
// number for a given input, while this one pins the invariants that must hold for *every*
// input. computeThreshold's output decides whether a real deployment is rolled back, and
// the failure mode that matters is not a wrong decimal -- it is a threshold that silently
// goes negative, or a window of zero seconds, which no single worked example would catch.

function vector(overrides: Partial<ChangeVector> = {}): ChangeVector {
  return {
    infra: 0,
    dependency: 0,
    config: 0,
    code: 0,
    code_complexity: 0,
    ...overrides,
  } as ChangeVector;
}

/** Every corner of the input space: each type alone at its extremes, all types together,
 *  and complexity layered on top. */
const VECTORS: Array<[label: string, value: ChangeVector]> = [
  ["all zero", vector()],
  ["infra minimal", vector({ infra: 0.0001 })],
  ["infra maximal", vector({ infra: 1 })],
  ["dependency maximal", vector({ dependency: 1 })],
  ["config maximal", vector({ config: 1 })],
  ["code maximal", vector({ code: 1 })],
  ["all types maximal", vector({ infra: 1, dependency: 1, config: 1, code: 1 })],
  ["all types mid", vector({ infra: 0.5, dependency: 0.5, config: 0.5, code: 0.5 })],
  ["maximal with full complexity", vector({ infra: 1, code: 1, code_complexity: 1 })],
  ["mid with mid complexity", vector({ config: 0.4, code_complexity: 0.5 })],
];

describe("threshold invariants that must hold for every vector", () => {
  // A negative threshold would be crossed by every possible error rate, rolling back every
  // deployment. A negative window would be a nonsensical evaluation period.
  it.each(VECTORS)("%s never yields a negative threshold or window", (_label, v) => {
    const result = computeThreshold(v);

    expect(result.finalThreshold).toBeGreaterThanOrEqual(0);
    expect(result.finalWindow).toBeGreaterThanOrEqual(0);
  });

  it.each(VECTORS)("%s never yields NaN", (_label, v) => {
    const result = computeThreshold(v);

    expect(Number.isNaN(result.finalThreshold)).toBe(false);
    expect(Number.isNaN(result.finalWindow)).toBe(false);
  });

  // The decay formula only ever reduces a baseline, so a computed threshold above the
  // loosest configured baseline would mean the formula had inverted.
  it.each(VECTORS.filter(([label]) => label !== "all zero"))(
    "%s stays within the configured baselines",
    (_label, v) => {
      const result = computeThreshold(v);
      const loosestThreshold = Math.max(...Object.values(DEFAULT_CONFIG.baseThreshold));
      const widestWindow = Math.max(...Object.values(DEFAULT_CONFIG.baseWindow));

      expect(result.finalThreshold).toBeLessThanOrEqual(loosestThreshold);
      expect(result.finalWindow).toBeLessThanOrEqual(widestWindow);
    }
  );

  it.each(VECTORS)("%s reports only types that are actually present", (_label, v) => {
    const result = computeThreshold(v);

    for (const type of result.activeTypes) {
      expect(v[type]).toBeGreaterThan(0);
    }
    for (const type of ["infra", "dependency", "config", "code"] as const) {
      if (v[type] > 0) expect(result.activeTypes).toContain(type);
    }
  });
});

describe("the no-signal default", () => {
  // Documented contract: a signal-less commit must never trip a rollback by itself. Infinity
  // is what makes that true without a special case at every call site, so returning 0 here
  // would invert the meaning and roll back everything.
  it("returns Infinity, not zero, when no change type is active", () => {
    const result = computeThreshold(vector());

    expect(result.finalThreshold).toBe(Infinity);
    expect(result.finalWindow).toBe(Infinity);
    expect(result.activeTypes).toEqual([]);
  });

  it("is not affected by code_complexity alone", () => {
    const result = computeThreshold(vector({ code_complexity: 1 }));

    expect(result.finalThreshold).toBe(Infinity);
    expect(result.activeTypes).toEqual([]);
  });
});

describe("the strictest active type wins", () => {
  // A commit touching several categories must be held to the most sensitive one. Taking a
  // max, or the last value, would let an infra change hide behind a permissive code
  // threshold.
  it("picks the minimum contribution across active types", () => {
    const combined = computeThreshold(vector({ infra: 0.2, code: 0.2 }));
    const infraOnly = computeThreshold(vector({ infra: 0.2 }));

    expect(combined.finalThreshold).toBe(infraOnly.finalThreshold);
    expect(combined.activeTypes).toEqual(["infra", "code"]);
  });

  it("keeps infra stricter than code at equal magnitudes", () => {
    const infra = computeThreshold(vector({ infra: 0.5 }));
    const code = computeThreshold(vector({ code: 0.5 }));

    expect(infra.finalThreshold).toBeLessThan(code.finalThreshold);
    expect(infra.finalWindow).toBeLessThan(code.finalWindow);
  });
});

describe("decay direction", () => {
  // A larger change must tighten the threshold, never loosen it. A sign flip in the decay
  // term would reverse this while still producing plausible-looking numbers.
  it("a larger magnitude always tightens the threshold and the window", () => {
    const small = computeThreshold(vector({ config: 0.1 }));
    const large = computeThreshold(vector({ config: 0.9 }));

    expect(large.finalThreshold).toBeLessThan(small.finalThreshold);
    expect(large.finalWindow).toBeLessThan(small.finalWindow);
  });

  it("higher code_complexity always tightens the threshold further", () => {
    const plain = computeThreshold(vector({ code: 0.5 }));
    const complex = computeThreshold(vector({ code: 0.5, code_complexity: 0.8 }));

    expect(complex.finalThreshold).toBeLessThan(plain.finalThreshold);
  });

  // complexityDecay applies to the threshold only -- it is a separate multiplicative
  // penalty, not one of the per-type contributions the window is built from.
  it("code_complexity does not change the window", () => {
    const plain = computeThreshold(vector({ code: 0.5 }));
    const complex = computeThreshold(vector({ code: 0.5, code_complexity: 0.8 }));

    expect(complex.finalWindow).toBe(plain.finalWindow);
  });
});
