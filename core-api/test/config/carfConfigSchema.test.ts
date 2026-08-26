import { describe, expect, it } from "vitest";
import { CarfConfigSchema } from "../../src/config/carfConfigSchema.js";

describe("CarfConfigSchema", () => {
  it("accepts an empty object (every top-level key optional)", () => {
    const result = CarfConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated valid config", () => {
    const result = CarfConfigSchema.safeParse({
      classification: {
        rules: [{ type: "infra", patterns: ["deploy/**/*.yaml"] }],
      },
      threshold: {
        decay: 0.6,
        complexityDecay: 0.3,
        types: {
          infra: { baseThreshold: 0.01, baseWindow: 60 },
          code: { baseThreshold: 0.08 },
        },
      },
      mode: "standalone",
      adapter: { kind: "kubernetes", target: "my-deployment" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown classification rule type", () => {
    const result = CarfConfigSchema.safeParse({
      classification: { rules: [{ type: "unclassified", patterns: ["*"] }] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects 'data' as a threshold.types key (threshold engine has no data category)", () => {
    const result = CarfConfigSchema.safeParse({
      threshold: { types: { data: { baseThreshold: 0.01 } } },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a partial threshold.types entry (only baseThreshold, no baseWindow)", () => {
    const result = CarfConfigSchema.safeParse({
      threshold: { types: { infra: { baseThreshold: 0.02 } } },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid mode value", () => {
    const result = CarfConfigSchema.safeParse({ mode: "chaos" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid adapter.kind value", () => {
    const result = CarfConfigSchema.safeParse({
      adapter: { kind: "chaos-monkey", target: "x" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts adapter.kind 'gitops' and 'dockerSwarm'", () => {
    expect(CarfConfigSchema.safeParse({ adapter: { kind: "gitops", target: "my-app" } }).success).toBe(true);
    expect(CarfConfigSchema.safeParse({ adapter: { kind: "dockerSwarm", target: "web" } }).success).toBe(true);
  });

  it("requires patterns to be a non-empty array on a classification rule", () => {
    const result = CarfConfigSchema.safeParse({
      classification: { rules: [{ type: "infra", patterns: [] }] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown top-level key (webhookSecret must never be a valid field)", () => {
    const result = CarfConfigSchema.safeParse({ github: { webhookSecret: "x" } });
    expect(result.success).toBe(false);
  });
});
