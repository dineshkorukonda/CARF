import { describe, expect, it, vi } from "vitest";
import { classifyTier1 } from "../../src/classifier/tier1.js";

describe("classifyTier1", () => {
  it("classifies one file of each pattern class", () => {
    const result = classifyTier1([
      "Dockerfile",
      "k8s/deploy.yaml",
      "main.tf",
      "package.json",
      "migrations/0001_init.sql",
      "src/handler.ts",
      "config/production.yaml",
    ]);

    const typeByPath = Object.fromEntries(result.files.map((f) => [f.path, f.type]));
    expect(typeByPath["Dockerfile"]).toBe("infra");
    expect(typeByPath["k8s/deploy.yaml"]).toBe("infra");
    expect(typeByPath["main.tf"]).toBe("infra");
    expect(typeByPath["package.json"]).toBe("dependency");
    expect(typeByPath["migrations/0001_init.sql"]).toBe("data");
    expect(typeByPath["src/handler.ts"]).toBe("code");
    expect(typeByPath["config/production.yaml"]).toBe("config");
  });

  it("tallies counts correctly for a mixed commit", () => {
    const result = classifyTier1([
      "src/a.ts",
      "src/b.ts",
      "config/app.yaml",
      "Dockerfile",
      "README.md",
    ]);

    expect(result.tally.code).toBe(2);
    expect(result.tally.config).toBe(1);
    expect(result.tally.infra).toBe(1);
    expect(result.tally.unclassified).toBe(1);
  });

  it("tags README/CHANGELOG/docs files as unclassified and excludes them from totalFiles", () => {
    const result = classifyTier1([
      "README.md",
      "CHANGELOG.md",
      "docs/architecture.md",
      "LICENSE",
      "assets/hero.svg",
      "src/handler.ts",
    ]);

    const unclassifiedPaths = result.files.filter((f) => f.type === "unclassified").map((f) => f.path);
    expect(unclassifiedPaths).toEqual(
      expect.arrayContaining(["README.md", "CHANGELOG.md", "docs/architecture.md", "LICENSE", "assets/hero.svg"])
    );
    // Only src/handler.ts (code) counts toward totalFiles.
    expect(result.totalFiles).toBe(1);
  });

  it("produces totalFiles === 0 for a commit touching only unclassified files", () => {
    const result = classifyTier1(["README.md", "docs/guide.md", "CHANGELOG.md"]);
    expect(result.totalFiles).toBe(0);
  });

  it("falls back a genuinely unmatched extension to unclassified and warns, without throwing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => classifyTier1(["weird/file.unknownext"])).not.toThrow();
    const result = classifyTier1(["weird/file.unknownext"]);
    expect(result.files[0]?.type).toBe("unclassified");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("computes totalFiles as classified-file count, not files.length", () => {
    const result = classifyTier1(["src/a.ts", "README.md"]);
    expect(result.files.length).toBe(2);
    expect(result.totalFiles).toBe(1);
  });

  it("resolves ambiguous paths by specificity: k8s/values.yaml is infra, bare values.yaml is config", () => {
    const result = classifyTier1(["k8s/values.yaml", "values.yaml"]);
    const typeByPath = Object.fromEntries(result.files.map((f) => [f.path, f.type]));
    expect(typeByPath["k8s/values.yaml"]).toBe("infra");
    expect(typeByPath["values.yaml"]).toBe("config");
  });

  it("resolves ambiguous paths by specificity: helm/**  wins over generic *.yaml", () => {
    const result = classifyTier1(["helm/charts/app/Chart.yaml", "Chart.yaml"]);
    const typeByPath = Object.fromEntries(result.files.map((f) => [f.path, f.type]));
    expect(typeByPath["helm/charts/app/Chart.yaml"]).toBe("infra");
    expect(typeByPath["Chart.yaml"]).toBe("config");
  });

  it("handles an empty diff", () => {
    const result = classifyTier1([]);
    expect(result.files).toEqual([]);
    expect(result.totalFiles).toBe(0);
  });
});
