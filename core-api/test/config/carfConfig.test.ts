import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { InvalidCarfConfigError, loadCarfConfig } from "../../src/config/carfConfig.js";

const fixturesDir = join(fileURLToPath(new URL(".", import.meta.url)), "fixtures");

describe("loadCarfConfig", () => {
  it("returns undefined when .carf.yml is missing (not an error)", () => {
    const result = loadCarfConfig(join(fixturesDir, "missing"));
    expect(result).toBeUndefined();
  });

  it("parses and validates a minimal valid .carf.yml", () => {
    const result = loadCarfConfig(join(fixturesDir, "valid-minimal"));
    expect(result).toEqual({ threshold: { decay: 0.6 } });
  });

  it("parses and validates a fully populated valid .carf.yml", () => {
    const result = loadCarfConfig(join(fixturesDir, "valid-full"));
    expect(result).toEqual({
      classification: {
        rules: [{ type: "infra", patterns: ["deploy/**/*.yaml"] }],
      },
      threshold: {
        decay: 0.6,
        complexityDecay: 0.25,
        types: { infra: { baseThreshold: 0.02, baseWindow: 45 } },
      },
      mode: "standalone",
      adapter: { kind: "kubernetes", target: "my-deployment" },
    });
  });

  it("throws InvalidCarfConfigError on malformed YAML", () => {
    expect(() => loadCarfConfig(join(fixturesDir, "invalid-syntax"))).toThrow(
      InvalidCarfConfigError
    );
  });

  it("throws InvalidCarfConfigError with a field-identifying message on schema violation", () => {
    expect(() => loadCarfConfig(join(fixturesDir, "invalid-schema"))).toThrow(
      InvalidCarfConfigError
    );
    try {
      loadCarfConfig(join(fixturesDir, "invalid-schema"));
      throw new Error("expected loadCarfConfig to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidCarfConfigError);
      expect((error as Error).message).toContain("mode");
    }
  });

  it("defaults repoRoot to process.cwd() when not provided", () => {
    // core-api's own repo root has no .carf.yml today, so this should
    // resolve the same way the "missing" fixture does: undefined, no throw.
    expect(() => loadCarfConfig()).not.toThrow();
  });
});
