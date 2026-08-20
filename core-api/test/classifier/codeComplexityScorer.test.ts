import { describe, expect, it } from "vitest";
import { StubComplexityScorer, TreeSitterComplexityScorer } from "../../src/classifier/codeComplexityScorer.js";

describe("StubComplexityScorer", () => {
  const scorer = new StubComplexityScorer();

  it("scores an empty file list as 0", () => {
    expect(scorer.score([])).toBe(0);
  });

  it("scores a file with identical before/after as 0", () => {
    const score = scorer.score([{ path: "a.ts", before: "const a = 1;\n", after: "const a = 1;\n" }]);
    expect(score).toBe(0);
  });

  it("produces a deterministic score for a given input (not random)", () => {
    const codeFiles = [{ path: "a.ts", before: "const a = 1;\n", after: "const a = 1;\nconst b = 2;\n" }];
    const first = scorer.score(codeFiles);
    const second = scorer.score(codeFiles);
    expect(first).toBe(second);
  });

  it("is not always 0 — a real diff produces a positive score", () => {
    const score = scorer.score([
      { path: "a.ts", before: "const a = 1;\n", after: "const a = 1;\nconst b = 2;\nconst c = 3;\n" },
    ]);
    expect(score).toBeGreaterThan(0);
  });

  it("scores a larger diff higher than a smaller diff", () => {
    const small = scorer.score([{ path: "a.ts", before: "line1\n", after: "line1\nline2\n" }]);
    const large = scorer.score([
      { path: "a.ts", before: "line1\n", after: "line1\nline2\nline3\nline4\nline5\n" },
    ]);
    expect(large).toBeGreaterThan(small);
  });

  it("aggregates scores across multiple files in one commit", () => {
    const fileA = { path: "a.ts", before: "line1\n", after: "line1\nline2\n" };
    const fileB = { path: "b.ts", before: "line1\n", after: "line1\nline2\n" };
    const combined = scorer.score([fileA, fileB]);
    const singleA = scorer.score([fileA]);
    const singleB = scorer.score([fileB]);
    expect(combined).toBe(singleA + singleB);
  });
});

describe("TreeSitterComplexityScorer", () => {
  const scorer = new TreeSitterComplexityScorer();

  it("implements the CodeComplexityScorer interface (score() delegates to classifyTier2)", () => {
    expect(scorer.score([])).toBe(0);
  });

  it("scores a real AST structural change above zero", () => {
    const score = scorer.score([
      {
        path: "a.ts",
        before: "function classify(x) { return x; }",
        after: `function classify(x) {
          if (x > 0) { return "positive"; } else { return "non-positive"; }
        }`,
      },
    ]);
    expect(score).toBeGreaterThan(0);
  });

  it("does not throw for an unsupported extension, contributing 0", () => {
    expect(scorer.score([{ path: "script.rb", before: "puts 1", after: "puts 2" }])).toBe(0);
  });
});
