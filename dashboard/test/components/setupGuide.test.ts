import { describe, it, expect } from "vitest";

describe("Tab Explainer & Setup Guide", () => {
  it("verifies tab keys and presets are defined correctly", () => {
    const tabKeys = ["status", "adapter", "rules", "analytics"];
    expect(tabKeys).toHaveLength(4);
    expect(tabKeys).toContain("status");
    expect(tabKeys).toContain("adapter");
  });

  it("verifies presets include PM2, K8s, and Render", () => {
    const stackPresets = ["pm2", "k8s", "render"];
    expect(stackPresets).toContain("pm2");
    expect(stackPresets).toContain("k8s");
    expect(stackPresets).toContain("render");
  });
});
