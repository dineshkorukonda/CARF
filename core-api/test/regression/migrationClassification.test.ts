import { describe, expect, it } from "vitest";
import { classifyTier1 } from "../../src/classifier/tier1.js";
import { buildChangeVector, classifyCommit } from "../../src/classifier/vector.js";
import { computeThreshold, DEFAULT_CONFIG } from "../../src/threshold/engine.js";

describe("Regression: Database Migration Classification & Threshold Computation", () => {
  it("classifies standard migration directory patterns as 'data'", () => {
    const paths = [
      "migrations/001_create_users.sql",
      "src/db/migrations/002_add_index.sql",
      "db/migrate/20260901_create_orders.rb",
      "prisma/migrations/20260901120000_init/migration.sql",
    ];

    const result = classifyTier1(paths);
    expect(result.totalFiles).toBe(4);
    expect(result.tally.data).toBe(4);
    for (const file of result.files) {
      expect(file.type).toBe("data");
    }
  });

  it("produces a pure data ChangeVector for migration-only commits", () => {
    const tier1 = classifyTier1(["migrations/001_initial_schema.sql"]);
    const vector = buildChangeVector(tier1, 0);

    expect(vector).not.toBeNull();
    expect(vector).toEqual({
      infra: 0,
      dependency: 0,
      config: 0,
      code: 0,
      data: 1,
      code_complexity: 0,
    });
  });

  it("computes a strict, finite threshold and window for migration commits", () => {
    const vector = classifyCommit([
      {
        path: "migrations/001_initial_schema.sql",
        before: "",
        after: "CREATE TABLE users (id SERIAL PRIMARY KEY);",
      },
    ]);

    expect(vector).not.toBeNull();
    expect(vector!.data).toBe(1);

    const result = computeThreshold(vector!);

    // Must NEVER return Infinity (which would disable rollback protection)
    expect(result.finalThreshold).toBeLessThan(Infinity);
    expect(result.finalWindow).toBeLessThan(Infinity);
    expect(result.activeTypes).toEqual(["data"]);

    // Must be tight: baseThreshold is 0.01, with decay 0.5 -> 0.005
    expect(result.finalThreshold).toBeCloseTo(0.01 * (1 - DEFAULT_CONFIG.decay * 1));
    // Window: baseWindow is 600s, with decay 0.5 -> 300s
    expect(result.finalWindow).toBeCloseTo(600 * (1 - DEFAULT_CONFIG.decay * 1));
  });

  it("correctly weights mixed migration and code commits", () => {
    const vector = classifyCommit([
      {
        path: "migrations/002_add_col.sql",
        before: "",
        after: "ALTER TABLE users ADD COLUMN age INT;",
      },
      {
        path: "src/user.ts",
        before: "export class User {}",
        after: "export class User { age: number = 0; }",
      },
    ]);

    expect(vector).not.toBeNull();
    expect(vector!.data).toBeCloseTo(0.5);
    expect(vector!.code).toBeCloseTo(0.5);

    const result = computeThreshold(vector!);
    expect(result.activeTypes).toContain("data");
    expect(result.activeTypes).toContain("code");
    // The stricter threshold (data: 0.01 vs code: 0.08) governs the finalThreshold
    expect(result.finalThreshold).toBeLessThanOrEqual(DEFAULT_CONFIG.baseThreshold.data);
  });
});
