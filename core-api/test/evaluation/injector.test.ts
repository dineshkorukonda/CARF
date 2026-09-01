import { describe, expect, it } from "vitest";
import { generateSyntheticDeployments } from "../../src/evaluation/injector.js";

// The synthetic dataset is the input to #14's H1 proof. If its balance or labelling drifts,
// every metric the evaluation reports drifts with it, silently -- the harness would still
// run and still produce a report, just a meaningless one.

describe("generateSyntheticDeployments", () => {
  it("returns exactly n deployments", () => {
    expect(generateSyntheticDeployments(0)).toHaveLength(0);
    expect(generateSyntheticDeployments(1)).toHaveLength(1);
    expect(generateSyntheticDeployments(100)).toHaveLength(100);
  });

  it("splits an even n exactly 50/50 between safe and risky", () => {
    const deployments = generateSyntheticDeployments(100);

    expect(deployments.filter((d) => d.category === "safe")).toHaveLength(50);
    expect(deployments.filter((d) => d.category === "risky")).toHaveLength(50);
  });

  // The label is the ground truth every precision/recall figure is measured against, so it
  // must track the category exactly, not approximately.
  it("labels every risky deployment shouldFail and every safe one not", () => {
    for (const deployment of generateSyntheticDeployments(40)) {
      expect(deployment.shouldFail).toBe(deployment.category === "risky");
    }
  });

  it("gives every deployment a unique, zero-padded id", () => {
    const deployments = generateSyntheticDeployments(20);
    const ids = deployments.map((d) => d.id);

    expect(new Set(ids).size).toBe(20);
    expect(ids[0]).toBe("synthetic-0000");
    expect(ids[19]).toBe("synthetic-0019");
  });

  it("is deterministic, so two runs of the harness are comparable", () => {
    expect(generateSyntheticDeployments(20)).toEqual(generateSyntheticDeployments(20));
  });

  // Both sub-flavors must appear on each side, or the evaluation only ever measures half
  // the scenarios it claims to cover.
  it("represents both safe flavors and both risky flavors", () => {
    const deployments = generateSyntheticDeployments(8);
    const paths = deployments.map((d) => d.changedFiles.map((f) => f.path).join(","));

    expect(paths.some((p) => p.includes("config/app.yaml"))).toBe(true);
    expect(paths.some((p) => p.includes("src/server.ts"))).toBe(true);
    expect(paths.some((p) => p.includes("migrations/"))).toBe(true);
    expect(paths.some((p) => p.includes("k8s/"))).toBe(true);
  });

  it("gives every deployment at least one changed file with real content", () => {
    for (const deployment of generateSyntheticDeployments(20)) {
      expect(deployment.changedFiles.length).toBeGreaterThan(0);
      for (const file of deployment.changedFiles) {
        expect(file.path.length).toBeGreaterThan(0);
        expect(file.after).not.toBe(file.before);
      }
    }
  });

  // The migration flavor deliberately pairs the .sql file with a code file: a
  // migration-only diff classifies as Tier 1 "data", which carries no threshold-engine
  // signal at all. See the doc comment on riskySchemaMigration.
  it("pairs a schema migration with a code file so the diff carries signal", () => {
    const migration = generateSyntheticDeployments(2).find((d) =>
      d.changedFiles.some((f) => f.path.startsWith("migrations/"))
    );

    expect(migration).toBeDefined();
    expect(migration!.changedFiles.length).toBeGreaterThan(1);
    expect(migration!.changedFiles.some((f) => f.path.endsWith(".ts"))).toBe(true);
  });
});
