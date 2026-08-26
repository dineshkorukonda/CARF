import { dump, load } from "js-yaml";
import { describe, expect, it } from "vitest";
import { applyClassificationThresholdPatch, applyModeAdapterPatch, InvalidCarfConfigError } from "../../src/lib/carfConfigWriter";

describe("applyModeAdapterPatch", () => {
  it("creates a minimal document when the repo has no .carf.yml yet", () => {
    const result = applyModeAdapterPatch(null, {
      mode: "standalone",
      adapter: { kind: "kubernetes", target: "my-deployment" },
    });

    expect(load(result)).toEqual({
      mode: "standalone",
      adapter: { kind: "kubernetes", target: "my-deployment" },
    });
  });

  it("preserves existing classification/threshold sections untouched", () => {
    const existing = dump({
      classification: { rules: [{ type: "infra", patterns: ["deploy/**"] }] },
      threshold: { decay: 0.6 },
      mode: "augment",
    });

    const result = applyModeAdapterPatch(existing, {
      mode: "standalone",
      adapter: { kind: "pm2", target: "web" },
    });

    expect(load(result)).toEqual({
      classification: { rules: [{ type: "infra", patterns: ["deploy/**"] }] },
      threshold: { decay: 0.6 },
      mode: "standalone",
      adapter: { kind: "pm2", target: "web" },
    });
  });

  it("drops a stale adapter block when switching to augment mode", () => {
    const existing = dump({ mode: "standalone", adapter: { kind: "kubernetes", target: "old" } });

    const result = applyModeAdapterPatch(existing, { mode: "augment" });

    expect(load(result)).toEqual({ mode: "augment" });
  });

  it("throws when mode is standalone but no adapter is given", () => {
    expect(() => applyModeAdapterPatch(null, { mode: "standalone" })).toThrow(InvalidCarfConfigError);
  });

  it("throws for an invalid adapter kind", () => {
    expect(() =>
      applyModeAdapterPatch(null, {
        mode: "standalone",
        adapter: { kind: "not-a-real-adapter" as never, target: "x" },
      })
    ).toThrow();
  });

  it("throws when the existing .carf.yml's top level isn't a mapping", () => {
    expect(() => applyModeAdapterPatch("- just\n- a\n- list\n", { mode: "augment" })).toThrow(InvalidCarfConfigError);
  });
});

describe("applyClassificationThresholdPatch", () => {
  it("writes classification.rules and threshold into a new document", () => {
    const result = applyClassificationThresholdPatch(null, {
      classification: { rules: [{ type: "infra", patterns: ["deploy/**/*.yaml"] }] },
      threshold: { decay: 0.6, types: { infra: { baseThreshold: 0.01, baseWindow: 60 } } },
    });

    expect(load(result)).toEqual({
      classification: { rules: [{ type: "infra", patterns: ["deploy/**/*.yaml"] }] },
      threshold: { decay: 0.6, types: { infra: { baseThreshold: 0.01, baseWindow: 60 } } },
    });
  });

  it("preserves existing mode/adapter untouched", () => {
    const existing = dump({ mode: "standalone", adapter: { kind: "kubernetes", target: "my-deployment" } });

    const result = applyClassificationThresholdPatch(existing, {
      classification: { rules: [{ type: "code", patterns: ["src/**"] }] },
    });

    expect(load(result)).toEqual({
      mode: "standalone",
      adapter: { kind: "kubernetes", target: "my-deployment" },
      classification: { rules: [{ type: "code", patterns: ["src/**"] }] },
    });
  });

  it("clears classification.rules entirely when given an empty rules array (drops the key, not { rules: [] })", () => {
    const existing = dump({ classification: { rules: [{ type: "infra", patterns: ["*"] }] } });

    const result = applyClassificationThresholdPatch(existing, { classification: { rules: [] } });

    expect(load(result)).toEqual({});
  });

  it("clears threshold entirely when omitted from the patch", () => {
    const existing = dump({ threshold: { decay: 0.5 } });

    const result = applyClassificationThresholdPatch(existing, {});

    expect(load(result)).toEqual({});
  });

  it("throws for an invalid classification rule (unknown change type)", () => {
    expect(() =>
      applyClassificationThresholdPatch(null, {
        classification: { rules: [{ type: "not-a-real-type" as never, patterns: ["*"] }] },
      })
    ).toThrow();
  });

  it("throws for an out-of-range decay value", () => {
    expect(() => applyClassificationThresholdPatch(null, { threshold: { decay: 1.5 } })).toThrow();
  });

  it("throws for an empty pattern string in a rule", () => {
    expect(() =>
      applyClassificationThresholdPatch(null, { classification: { rules: [{ type: "infra", patterns: [""] }] } })
    ).toThrow();
  });
});
