import { describe, expect, it } from "vitest";
import { classifyTier1, isTestPath } from "../../src/classifier/tier1.js";
import { classifyCommit } from "../../src/classifier/vector.js";
import { TreeSitterComplexityScorer } from "../../src/classifier/codeComplexityScorer.js";

describe("Test Churn Classification & Discounting", () => {
  it("correctly recognizes test file paths with isTestPath", () => {
    expect(isTestPath("src/auth.test.ts")).toBe(true);
    expect(isTestPath("src/components/Button.spec.tsx")).toBe(true);
    expect(isTestPath("tests/integration/api.py")).toBe(true);
    expect(isTestPath("internal/store/user_test.go")).toBe(true);
    expect(isTestPath("src/auth.ts")).toBe(false);
    expect(isTestPath("pkg/server/handler.go")).toBe(false);
  });

  it("classifies test files as type 'test' in Tier 1", () => {
    const result = classifyTier1([
      "src/service.ts",
      "src/service.test.ts",
      "tests/e2e.py",
      "README.md",
    ]);

    const typeByPath = Object.fromEntries(result.files.map((f) => [f.path, f.type]));
    expect(typeByPath["src/service.ts"]).toBe("code");
    expect(typeByPath["src/service.test.ts"]).toBe("test");
    expect(typeByPath["tests/e2e.py"]).toBe("test");
    expect(typeByPath["README.md"]).toBe("unclassified");

    expect(result.tally.code).toBe(1);
    expect(result.tally.test).toBe(2);
    expect(result.totalFiles).toBe(3);
  });

  it("dampens test file AST complexity by 0.1x compared to production code", () => {
    const scorer = new TreeSitterComplexityScorer();

    const complexFunction = `
      export function processItems(items: number[]) {
        let sum = 0;
        for (let i = 0; i < items.length; i++) {
          if (items[i] > 10) {
            sum += items[i] * 2;
          } else if (items[i] > 5) {
            sum += items[i];
          } else {
            sum -= 1;
          }
        }
        return sum;
      }
    `;

    // Production change:
    const prodVector = classifyCommit(
      [{ path: "src/processor.ts", before: "", after: complexFunction }],
      scorer
    );

    // Test file change with identical complex function:
    const testVector = classifyCommit(
      [{ path: "src/processor.test.ts", before: "", after: complexFunction }],
      scorer
    );

    expect(prodVector).not.toBeNull();
    expect(testVector).not.toBeNull();

    // The test complexity must be roughly 10% (0.1x) of the production complexity:
    expect(testVector!.code_complexity).toBeLessThan(prodVector!.code_complexity);
    expect(testVector!.code_complexity).toBeCloseTo(prodVector!.code_complexity * 0.1, 2);
  });
});
