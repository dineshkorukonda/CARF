import { describe, expect, it } from "vitest";
import {
  AdapterConfigSchema,
  AdapterKindSchema,
  ClassificationRuleSchema,
  ClassificationSchema,
  LIVE_ADAPTER_KINDS,
  ModeSchema,
  ThresholdSchema,
  ThresholdTypeOverrideSchema,
} from "../../src/lib/carfConfigSchema";

// This module is the dashboard's validation boundary: anything the config UI is about to
// write into a repo's real `.carf.yml` passes through here first. A gap here commits a
// config core-api can't read.

describe("AdapterKindSchema / LIVE_ADAPTER_KINDS", () => {
  it("accepts every adapter kind core-api can actually build", () => {
    for (const kind of LIVE_ADAPTER_KINDS) {
      expect(AdapterKindSchema.safeParse(kind).success).toBe(true);
    }
  });

  it("rejects an unknown adapter kind", () => {
    expect(AdapterKindSchema.safeParse("heroku").success).toBe(false);
  });

  // If the schema ever accepts a kind that isn't live-wired, the config UI can offer a
  // choice that silently no-ops at rollback time -- exactly the gap #73/#74 were about.
  it("has no schema kind that is missing from the live-wired list", () => {
    expect([...LIVE_ADAPTER_KINDS].sort()).toEqual([...AdapterKindSchema.options].sort());
  });
});

describe("AdapterConfigSchema", () => {
  it("accepts a well-formed adapter config", () => {
    const result = AdapterConfigSchema.safeParse({ kind: "kubernetes", target: "deploy/api" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty target", () => {
    expect(AdapterConfigSchema.safeParse({ kind: "pm2", target: "" }).success).toBe(false);
  });

  it("rejects an unknown key, so a typo never reaches .carf.yml", () => {
    const result = AdapterConfigSchema.safeParse({ kind: "pm2", target: "api", targt: "typo" });
    expect(result.success).toBe(false);
  });
});

describe("ModeSchema", () => {
  it("accepts the two supported modes", () => {
    expect(ModeSchema.safeParse("standalone").success).toBe(true);
    expect(ModeSchema.safeParse("augment").success).toBe(true);
  });

  it("rejects anything else", () => {
    expect(ModeSchema.safeParse("observe").success).toBe(false);
  });
});

describe("ClassificationRuleSchema", () => {
  it("accepts a rule with at least one pattern", () => {
    const result = ClassificationRuleSchema.safeParse({ type: "infra", patterns: ["terraform/**"] });
    expect(result.success).toBe(true);
  });

  it("rejects a rule with no patterns", () => {
    expect(ClassificationRuleSchema.safeParse({ type: "infra", patterns: [] }).success).toBe(false);
  });

  it("rejects an empty pattern string", () => {
    expect(ClassificationRuleSchema.safeParse({ type: "code", patterns: [""] }).success).toBe(false);
  });

  // Classification knows "data"; the threshold engine deliberately does not.
  it("accepts the classification-only 'data' type", () => {
    expect(ClassificationRuleSchema.safeParse({ type: "data", patterns: ["*.sql"] }).success).toBe(true);
  });
});

describe("ClassificationSchema", () => {
  it("accepts an omitted rules list", () => {
    expect(ClassificationSchema.safeParse({}).success).toBe(true);
  });

  it("rejects an unknown key", () => {
    expect(ClassificationSchema.safeParse({ rules: [], extra: 1 }).success).toBe(false);
  });
});

describe("ThresholdSchema", () => {
  it("accepts decay values at both ends of the 0..1 range", () => {
    expect(ThresholdSchema.safeParse({ decay: 0, complexityDecay: 1 }).success).toBe(true);
  });

  it("rejects a decay above 1", () => {
    expect(ThresholdSchema.safeParse({ decay: 1.5 }).success).toBe(false);
  });

  it("rejects a negative decay", () => {
    expect(ThresholdSchema.safeParse({ decay: -0.1 }).success).toBe(false);
  });

  it("accepts per-type overrides for the four threshold types", () => {
    const result = ThresholdSchema.safeParse({
      types: {
        infra: { baseThreshold: 0.02, baseWindow: 300 },
        dependency: { baseThreshold: 0.05 },
        config: { baseWindow: 120 },
        code: {},
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a 'data' threshold override", () => {
    const result = ThresholdSchema.safeParse({ types: { data: { baseThreshold: 0.01, baseWindow: 600 } } });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown threshold override type", () => {
    const result = ThresholdSchema.safeParse({ types: { invalid_type: { baseThreshold: 0.1 } } });
    expect(result.success).toBe(false);
  });
});

describe("ThresholdTypeOverrideSchema", () => {
  it("rejects a zero or negative baseThreshold", () => {
    expect(ThresholdTypeOverrideSchema.safeParse({ baseThreshold: 0 }).success).toBe(false);
    expect(ThresholdTypeOverrideSchema.safeParse({ baseThreshold: -1 }).success).toBe(false);
  });

  it("rejects a zero or negative baseWindow", () => {
    expect(ThresholdTypeOverrideSchema.safeParse({ baseWindow: 0 }).success).toBe(false);
  });

  it("accepts an empty override object", () => {
    expect(ThresholdTypeOverrideSchema.safeParse({}).success).toBe(true);
  });
});
