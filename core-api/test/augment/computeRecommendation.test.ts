import { describe, expect, it } from "vitest";
import { computeAugmentRecommendation } from "../../src/augment/computeRecommendation.js";

describe("computeAugmentRecommendation", () => {
  it("classifies a Dockerfile and returns the infra threshold/window", () => {
    const result = computeAugmentRecommendation([{ path: "Dockerfile", before: "", after: "FROM node:20\n" }]);
    expect(result).not.toBeNull();
    expect(result!.changeVector.infra).toBe(1);
    expect(result!.threshold).toBeLessThan(1);
    expect(result!.window).toBeGreaterThan(0);
  });

  it("returns null when every file is unclassified", () => {
    const result = computeAugmentRecommendation([{ path: "README.md", before: "", after: "# docs\n" }]);
    expect(result).toBeNull();
  });

  it("honors user classification rules before built-in rules", () => {
    const result = computeAugmentRecommendation(
      [{ path: "README.md", before: "", after: "# docs\n" }],
      [{ type: "infra", patterns: ["README.md"] }]
    );
    expect(result).not.toBeNull();
    expect(result!.changeVector.infra).toBe(1);
  });
});
