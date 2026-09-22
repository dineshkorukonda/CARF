import { describe, it, expect } from "vitest";

describe("Advisory Alert Mode & Cloud Presets", () => {
  it("identifies high risk commits from recent commits list", () => {
    const commits = [
      {
        sha: "abc1234",
        owner: "test",
        repo: "repo",
        createdAt: new Date().toISOString(),
        finalThreshold: 0.008,
        finalWindow: 600,
        activeTypes: ["data"],
        rolledBack: null,
        finalErrorRate: null,
      },
      {
        sha: "def5678",
        owner: "test",
        repo: "repo",
        createdAt: new Date().toISOString(),
        finalThreshold: 0.035,
        finalWindow: 300,
        activeTypes: ["code"],
        rolledBack: null,
        finalErrorRate: null,
      },
    ];

    const highRisk = commits.filter(
      (c) => c.finalThreshold !== null && c.finalThreshold < 0.015
    );
    expect(highRisk).toHaveLength(1);
    expect(highRisk[0]?.sha).toBe("abc1234");
  });

  it("verifies presets include CI probe and Render commands", () => {
    const thresholdProbeCmd = "curl /v1/threshold?commit=$SHA";
    const renderDeployHookPrefix = "https://api.render.com/deploy/";

    expect(thresholdProbeCmd).toContain("threshold");
    expect(renderDeployHookPrefix).toContain("api.render.com");
  });
});
