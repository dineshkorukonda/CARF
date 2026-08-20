import { describe, expect, it, vi } from "vitest";
import {
  CYCLOMATIC_WEIGHT,
  FUNCTIONS_CHANGED_WEIGHT,
  NESTING_DEPTH_WEIGHT,
  SIGNATURE_CHANGE_WEIGHT,
  classifyTier2,
  computeAstScore,
  diffAst,
  parseWithGrammar,
} from "../../src/classifier/tier2.js";

describe("parseWithGrammar", () => {
  it("parses TypeScript source into a syntax tree", () => {
    const tree = parseWithGrammar("const a = 1;", "typescript");
    expect(tree.rootNode.type).toBe("program");
    expect(tree.rootNode.hasError).toBe(false);
  });

  it("parses Python source into a syntax tree", () => {
    const tree = parseWithGrammar("a = 1\n", "python");
    expect(tree.rootNode.hasError).toBe(false);
  });

  it("parses Go source into a syntax tree", () => {
    const tree = parseWithGrammar("package main\nfunc main() {}\n", "go");
    expect(tree.rootNode.hasError).toBe(false);
  });

  it("parses Rust source into a syntax tree", () => {
    const tree = parseWithGrammar("fn main() {}\n", "rust");
    expect(tree.rootNode.hasError).toBe(false);
  });

  it("parses Java source into a syntax tree", () => {
    const tree = parseWithGrammar("class A { void m() {} }\n", "java");
    expect(tree.rootNode.hasError).toBe(false);
  });

  it("throws for an unsupported grammar name", () => {
    expect(() => parseWithGrammar("x", "cobol")).toThrow();
  });
});

describe("diffAst", () => {
  // Hand-crafted pair 1: pure identifier rename. Structurally identical — same node
  // types throughout, only an identifier's text differs. Should read as ~zero delta.
  it("treats a renamed local variable as a LOW delta (near-zero score)", () => {
    const before = `
      function add(a, b) {
        const sum = a + b;
        return sum;
      }
    `;
    const after = `
      function add(a, b) {
        const total = a + b;
        return total;
      }
    `;

    const delta = diffAst(before, after, "typescript");

    expect(delta.functionsChanged).toBe(0);
    expect(delta.signatureChanges).toBe(0);
    expect(delta.nestingDepthDelta).toBe(0);
    expect(delta.cyclomaticDelta).toBe(0);
    expect(computeAstScore(delta)).toBe(0);
  });

  // Hand-crafted pair 2: an added if/else branch increases nesting depth and cyclomatic
  // complexity by one decision point.
  it("detects a new if/else branch as a nesting depth increase", () => {
    const before = `
      function classify(x) {
        return x;
      }
    `;
    const after = `
      function classify(x) {
        if (x > 0) {
          return "positive";
        } else {
          return "non-positive";
        }
      }
    `;

    const delta = diffAst(before, after, "typescript");

    expect(delta.nestingDepthDelta).toBe(1);
    expect(delta.cyclomaticDelta).toBeGreaterThanOrEqual(1);
    expect(delta.functionsChanged).toBe(1);
  });

  // Hand-crafted pair 3: a parameter is added to a function signature; the body is
  // untouched, isolating the signature-change signal.
  it("detects a function signature parameter addition", () => {
    const before = `
      function greet(name) {
        return "hi " + name;
      }
    `;
    const after = `
      function greet(name, greeting) {
        return "hi " + name;
      }
    `;

    const delta = diffAst(before, after, "typescript");

    expect(delta.signatureChanges).toBe(1);
  });

  // Hand-crafted pair 4: a nested while loop is added inside an existing if branch,
  // exercising both cyclomatic and nesting deltas together, in Python.
  it("detects an added nested loop in Python as nesting + cyclomatic increases", () => {
    const before = `
def process(items):
    if items:
        return len(items)
    return 0
`;
    const after = `
def process(items):
    if items:
        total = 0
        while items:
            total += 1
            items = items[1:]
        return total
    return 0
`;

    const delta = diffAst(before, after, "python");

    expect(delta.nestingDepthDelta).toBeGreaterThanOrEqual(1);
    expect(delta.cyclomaticDelta).toBeGreaterThanOrEqual(1);
    expect(delta.functionsChanged).toBe(1);
  });

  // Hand-crafted pair 5: a whole new function is added alongside an unrelated existing
  // one — functionsChanged must count the addition even though the existing function
  // is untouched.
  it("counts a wholly new function as a functionsChanged addition", () => {
    const before = `
      function existing() {
        return 1;
      }
    `;
    const after = `
      function existing() {
        return 1;
      }

      function added(x) {
        return x * 2;
      }
    `;

    const delta = diffAst(before, after, "typescript");

    expect(delta.functionsChanged).toBe(1);
  });

  it("detects a removed function as a functionsChanged removal", () => {
    const before = `
      function keep() {
        return 1;
      }

      function removeMe() {
        return 2;
      }
    `;
    const after = `
      function keep() {
        return 1;
      }
    `;

    const delta = diffAst(before, after, "typescript");

    expect(delta.functionsChanged).toBe(1);
  });
});

describe("computeAstScore", () => {
  it("computes a weighted sum from the configured weight constants", () => {
    const delta = { functionsChanged: 2, signatureChanges: 1, nestingDepthDelta: 2, cyclomaticDelta: 3 };
    const expected =
      2 * FUNCTIONS_CHANGED_WEIGHT +
      1 * SIGNATURE_CHANGE_WEIGHT +
      2 * NESTING_DEPTH_WEIGHT +
      3 * CYCLOMATIC_WEIGHT;

    expect(computeAstScore(delta)).toBe(expected);
  });

  it("returns 0 for an all-zero delta", () => {
    expect(computeAstScore({ functionsChanged: 0, signatureChanges: 0, nestingDepthDelta: 0, cyclomaticDelta: 0 })).toBe(0);
  });
});

describe("classifyTier2", () => {
  it("returns 0 for an empty commit", () => {
    expect(classifyTier2([])).toBe(0);
  });

  it("aggregates scores across multiple code files in one commit", () => {
    const fileA = {
      path: "a.ts",
      before: "function classify(x) { return x; }",
      after: `function classify(x) {
        if (x > 0) { return "positive"; } else { return "non-positive"; }
      }`,
    };
    const fileB = {
      path: "b.py",
      before: "def process(items):\n    if items:\n        return len(items)\n    return 0\n",
      after:
        "def process(items):\n    if items:\n        total = 0\n        while items:\n            total += 1\n            items = items[1:]\n        return total\n    return 0\n",
    };

    const combined = classifyTier2([fileA, fileB]);
    const singleA = classifyTier2([fileA]);
    const singleB = classifyTier2([fileB]);

    expect(combined).toBeCloseTo(singleA + singleB, 10);
    expect(combined).toBeGreaterThan(0);
  });

  it("does not throw for an unsupported file extension and contributes 0 to the score", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const score = classifyTier2([{ path: "script.rb", before: "puts 1", after: "puts 2" }]);

    expect(score).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("still scores supported files when an unsupported file is present alongside them", () => {
    const supported = {
      path: "a.ts",
      before: "function classify(x) { return x; }",
      after: `function classify(x) {
        if (x > 0) { return "positive"; } else { return "non-positive"; }
      }`,
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const score = classifyTier2([supported, { path: "script.rb", before: "puts 1", after: "puts 2" }]);
    const soloScore = classifyTier2([supported]);

    expect(score).toBe(soloScore);
    warnSpy.mockRestore();
  });
});
