import { describe, expect, it } from "vitest";
import { buildChangeVector, classifyCommit } from "../../src/classifier/vector.js";
import { classifyTier1 } from "../../src/classifier/tier1.js";
import type { CodeComplexityScorer } from "../../src/classifier/codeComplexityScorer.js";

describe("buildChangeVector", () => {
  it("returns null when totalFiles is 0 (all-unclassified commit)", () => {
    const tier1 = classifyTier1(["README.md", "CHANGELOG.md"]);
    expect(buildChangeVector(tier1, 0)).toBeNull();
  });

  it("returns null for an empty diff", () => {
    const tier1 = classifyTier1([]);
    expect(buildChangeVector(tier1, 0)).toBeNull();
  });

  it("produces a vector for a single-file single-category commit that sums to 1.0", () => {
    const tier1 = classifyTier1(["src/handler.ts"]);
    const vector = buildChangeVector(tier1, 0);
    expect(vector).not.toBeNull();
    expect(vector!.code).toBe(1);
    expect(vector!.infra + vector!.dependency + vector!.config + vector!.code + vector!.data).toBeCloseTo(1.0);
  });

  it("produces a weighted vector for a mixed-category commit", () => {
    const tier1 = classifyTier1(["src/a.ts", "src/b.ts", "config/app.yaml", "Dockerfile"]);
    const vector = buildChangeVector(tier1, 0);
    expect(vector).not.toBeNull();
    expect(vector!.code).toBeCloseTo(0.5); // 2/4
    expect(vector!.config).toBeCloseTo(0.25); // 1/4
    expect(vector!.infra).toBeCloseTo(0.25); // 1/4
    expect(vector!.infra + vector!.dependency + vector!.config + vector!.code + vector!.data).toBeCloseTo(1.0);
  });

  it("produces a vector for database migrations classified as data", () => {
    const tier1 = classifyTier1(["migrations/001_create_users.sql"]);
    const vector = buildChangeVector(tier1, 0);
    expect(vector).not.toBeNull();
    expect(vector!.data).toBe(1);
    expect(vector!.code).toBe(0);
  });

  it("excludes unclassified files from the weighting (README alongside code doesn't dilute code weight)", () => {
    const tier1 = classifyTier1(["src/handler.ts", "README.md"]);
    const vector = buildChangeVector(tier1, 0);
    expect(vector).not.toBeNull();
    expect(vector!.code).toBe(1); // not 0.5 — README excluded from totalFiles
  });

  it("clamps code_complexity to [0, 1] via MAX_COMPLEXITY_CEILING", () => {
    const tier1 = classifyTier1(["src/handler.ts"]);
    const belowCeiling = buildChangeVector(tier1, 10);
    const atCeiling = buildChangeVector(tier1, 50);
    const aboveCeiling = buildChangeVector(tier1, 500);
    expect(belowCeiling!.code_complexity).toBeCloseTo(0.2);
    expect(atCeiling!.code_complexity).toBeCloseTo(1.0);
    expect(aboveCeiling!.code_complexity).toBe(1.0);
  });

  it("never produces a negative code_complexity", () => {
    const tier1 = classifyTier1(["src/handler.ts"]);
    const vector = buildChangeVector(tier1, -5);
    expect(vector!.code_complexity).toBeGreaterThanOrEqual(0);
  });
});

describe("classifyCommit", () => {
  const zeroScorer: CodeComplexityScorer = { score: () => 0 };

  it("is the single pipeline entry point: full commit diff fixture in -> exact ChangeVector out", () => {
    const vector = classifyCommit(
      [
        { path: "src/handler.ts", before: "old", after: "new" },
        { path: "config/app.yaml", before: "a: 1", after: "a: 2" },
        { path: "Dockerfile", before: "FROM node:18", after: "FROM node:20" },
        { path: "README.md", before: "old readme", after: "new readme" },
      ],
      zeroScorer
    );

    expect(vector).toEqual({
      infra: 1 / 3,
      dependency: 0,
      config: 1 / 3,
      code: 1 / 3,
      data: 0,
      code_complexity: 0,
    });
  });

  it("routes only Tier-1-classified 'code' files into the CodeComplexityScorer", () => {
    let scoredPaths: string[] = [];
    const spyScorer: CodeComplexityScorer = {
      score: (files) => {
        scoredPaths = files.map((f) => f.path);
        return 0;
      },
    };

    classifyCommit(
      [
        { path: "src/handler.ts", before: "old", after: "new" },
        { path: "config/app.yaml", before: "a: 1", after: "a: 2" },
      ],
      spyScorer
    );

    expect(scoredPaths).toEqual(["src/handler.ts"]);
  });

  it("returns null (no-op) for a commit touching only unclassified files", () => {
    const vector = classifyCommit(
      [{ path: "README.md", before: "old", after: "new" }],
      zeroScorer
    );
    expect(vector).toBeNull();
  });

  it("defaults to TreeSitterComplexityScorer when no scorer is provided", () => {
    const vector = classifyCommit([
      {
        path: "src/handler.ts",
        before: "function handle() { return 1; }",
        after: "function handle() { if (true) return 2; return 1; }",
      },
    ]);
    expect(vector).not.toBeNull();
    expect(vector!.code_complexity).toBeGreaterThan(0);
  });

  it("threads userRules through to Tier 1 classification", () => {
    const vector = classifyCommit(
      [{ path: "config/production.yaml", before: "a", after: "b" }],
      zeroScorer,
      [{ type: "infra", patterns: ["config/production.yaml"] }]
    );
    // Reclassified as infra by the user rule, so it's still the only
    // classified file and infra takes the full weight.
    expect(vector).toEqual({
      infra: 1,
      dependency: 0,
      config: 0,
      code: 0,
      data: 0,
      code_complexity: 0,
    });
  });
});
