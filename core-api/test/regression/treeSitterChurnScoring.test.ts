import { describe, expect, it } from "vitest";
import { computeAstScore, classifyTier2 } from "../../src/classifier/tier2.js";
import { TreeSitterComplexityScorer } from "../../src/classifier/codeComplexityScorer.js";

describe("Regression: Tree-Sitter AST Churn Complexity & Deletion Safety", () => {
  it("computeAstScore never returns a negative number even for massive deletions", () => {
    const deltaWithNegativeDeltas = {
      functionsChanged: 0,
      signatureChanges: 0,
      nestingDepthDelta: -20,
      cyclomaticDelta: -50,
    };

    const score = computeAstScore(deltaWithNegativeDeltas);
    expect(score).toBe(0);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("deleting functions in file A does not subtract from new complexity in file B", () => {
    // File A: heavily refactored / deleted complex code
    const fileA = {
      path: "src/oldModule.ts",
      before: `
        function deeplyNested(a: number) {
          if (a > 1) {
            for (let i = 0; i < 10; i++) {
              if (i % 2 === 0) {
                while (a < 100) {
                  a++;
                }
              }
            }
          }
          return a;
        }
      `,
      after: "", // completely deleted
    };

    // File B: added complex logic
    const fileB = {
      path: "src/newModule.ts",
      before: "",
      after: `
        function newComplexLogic(x: number) {
          if (x > 0) {
            return x * 2;
          }
          return 0;
        }
      `,
    };

    const scoreFileBOnly = classifyTier2([fileB]);
    expect(scoreFileBOnly).toBeGreaterThan(0);

    const scoreBoth = classifyTier2([fileA, fileB]);
    // The combined score must be at least as large as File B alone; deleting File A must not reduce File B's score
    expect(scoreBoth).toBeGreaterThanOrEqual(scoreFileBOnly);
  });

  it("TreeSitterComplexityScorer accurately scores TypeScript and Python syntax changes", () => {
    const scorer = new TreeSitterComplexityScorer();
    const score = scorer.score([
      {
        path: "src/handler.ts",
        before: "function handle() { return 1; }",
        after: "function handle() { if (true) { return 2; } return 1; }",
      },
      {
        path: "services/worker.py",
        before: "def work(): pass",
        after: "def work():\n    for i in range(10):\n        if i > 5: pass",
      },
    ]);

    expect(score).toBeGreaterThan(0);
  });
});
