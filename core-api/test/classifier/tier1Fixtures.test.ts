import { describe, expect, it } from "vitest";
import { classifyTier1 } from "../../src/classifier/tier1.js";
import { classifyCommit } from "../../src/classifier/vector.js";
import { computeThreshold, DEFAULT_CONFIG, CURRENT_ENGINE_CONFIG } from "../../src/threshold/engine.js";

describe("Tier 1 Language Fixtures and Versioned Engine Config", () => {
  it("verifies engine config version and default values", () => {
    expect(CURRENT_ENGINE_CONFIG.version).toBe("v1");
    expect(CURRENT_ENGINE_CONFIG.baseThreshold).toEqual({
      infra: 0.01,
      dependency: 0.03,
      config: 0.05,
      code: 0.08,
      data: 0.01,
    });
    expect(CURRENT_ENGINE_CONFIG.baseWindow).toEqual({
      infra: 60,
      dependency: 180,
      config: 300,
      code: 900,
      data: 600,
    });
    expect(CURRENT_ENGINE_CONFIG).toMatchObject(DEFAULT_CONFIG);
  });

  describe("Java project diffs", () => {
    it("correctly classifies Java dependencies, config, migrations, code, and tests", () => {
      const paths = [
        "pom.xml",
        "build.gradle",
        "src/main/resources/application.properties",
        "src/main/resources/application.yml",
        "src/main/resources/db/migration/V1__init_users.sql",
        "src/main/java/com/example/service/UserService.java",
        "src/test/java/com/example/service/UserServiceTest.java",
      ];

      const result = classifyTier1(paths);

      expect(result.tally.dependency).toBe(2);
      expect(result.tally.config).toBe(2);
      expect(result.tally.data).toBe(1);
      expect(result.tally.code).toBe(1);
      expect(result.tally.test).toBe(1);

      const mapping = Object.fromEntries(result.files.map((f) => [f.path, f.type]));
      expect(mapping["pom.xml"]).toBe("dependency");
      expect(mapping["build.gradle"]).toBe("dependency");
      expect(mapping["src/main/resources/application.properties"]).toBe("config");
      expect(mapping["src/main/resources/application.yml"]).toBe("config");
      expect(mapping["src/main/resources/db/migration/V1__init_users.sql"]).toBe("data");
      expect(mapping["src/main/java/com/example/service/UserService.java"]).toBe("code");
      expect(mapping["src/test/java/com/example/service/UserServiceTest.java"]).toBe("test");
    });

    it("evaluates threshold and window correctly for a Java migration diff", () => {
      const files = [
        { path: "src/main/resources/db/migration/V2__add_index.sql", additions: 15, deletions: 0, before: "", after: "-- migration" },
      ];
      const vector = classifyCommit(files);
      expect(vector).not.toBeNull();
      expect(vector!.data).toBe(1);

      const result = computeThreshold(vector!);
      // data baseThreshold is 0.01, decay is 0.5 -> 0.01 * (1 - 0.5 * 1) = 0.005
      expect(result.finalThreshold).toBeCloseTo(0.005);
      // data baseWindow is 600s, decay is 0.5 -> 600 * (1 - 0.5 * 1) = 300s
      expect(result.finalWindow).toBe(300);
      expect(result.activeTypes).toEqual(["data"]);
    });
  });

  describe("TypeScript project diffs", () => {
    it("correctly classifies TS dependencies (npm/pnpm), config, schema, code, and tests", () => {
      const paths = [
        "package.json",
        "package-lock.json",
        "pnpm-lock.yaml",
        ".env",
        ".env.production",
        "ecosystem.config.cjs",
        "ecosystem.config.js",
        "prisma/migrations/20260928000000_init/migration.sql",
        "src/server.ts",
        "src/routes/api.ts",
        "test/server.test.ts",
      ];

      const result = classifyTier1(paths);

      const mapping = Object.fromEntries(result.files.map((f) => [f.path, f.type]));
      expect(mapping["package.json"]).toBe("dependency");
      expect(mapping["package-lock.json"]).toBe("dependency");
      expect(mapping["pnpm-lock.yaml"]).toBe("dependency");
      expect(mapping[".env"]).toBe("config");
      expect(mapping[".env.production"]).toBe("config");
      expect(mapping["ecosystem.config.cjs"]).toBe("config");
      expect(mapping["ecosystem.config.js"]).toBe("config");
      expect(mapping["prisma/migrations/20260928000000_init/migration.sql"]).toBe("data");
      expect(mapping["src/server.ts"]).toBe("code");
      expect(mapping["src/routes/api.ts"]).toBe("code");
      expect(mapping["test/server.test.ts"]).toBe("test");
    });
  });

  describe("Next.js project diffs", () => {
    it("correctly classifies Next.js configuration, pages/components, and static assets", () => {
      const paths = [
        "next.config.js",
        "next.config.mjs",
        "next.config.ts",
        "src/app/page.tsx",
        "src/components/Header.tsx",
        "src/components/Header.test.tsx",
        "public/logo.png",
        "README.md",
      ];

      const result = classifyTier1(paths);

      const mapping = Object.fromEntries(result.files.map((f) => [f.path, f.type]));
      expect(mapping["next.config.js"]).toBe("config");
      expect(mapping["next.config.mjs"]).toBe("config");
      expect(mapping["next.config.ts"]).toBe("config");
      expect(mapping["src/app/page.tsx"]).toBe("code");
      expect(mapping["src/components/Header.tsx"]).toBe("code");
      expect(mapping["src/components/Header.test.tsx"]).toBe("test");
      expect(mapping["public/logo.png"]).toBe("unclassified");
      expect(mapping["README.md"]).toBe("unclassified");
    });

    it("evaluates threshold and window correctly for Next.js config change", () => {
      const files = [
        { path: "next.config.ts", additions: 10, deletions: 2, before: "", after: "export default {};" },
      ];
      const vector = classifyCommit(files);
      expect(vector).not.toBeNull();
      expect(vector!.config).toBe(1);

      const result = computeThreshold(vector!);
      // config baseThreshold is 0.05, decay is 0.5 -> 0.05 * (1 - 0.5 * 1) = 0.025
      expect(result.finalThreshold).toBeCloseTo(0.025);
      // config baseWindow is 300s, decay is 0.5 -> 300 * (1 - 0.5 * 1) = 150s
      expect(result.finalWindow).toBe(150);
      expect(result.activeTypes).toEqual(["config"]);
    });
  });
});
