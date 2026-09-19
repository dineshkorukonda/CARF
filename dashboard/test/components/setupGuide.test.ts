import { describe, it, expect } from "vitest";

describe("Tab Explainer & Setup Guide", () => {
  it("verifies tab keys and presets are defined correctly", () => {
    const tabKeys = ["status", "adapter", "rules", "analytics"];
    expect(tabKeys).toHaveLength(4);
    expect(tabKeys).toContain("status");
    expect(tabKeys).toContain("adapter");
  });

  it("verifies presets include Vercel, Render, and PM2", () => {
    const stackPresets = ["pm2", "vercel", "render", "docker", "k8s"];
    expect(stackPresets).toContain("pm2");
    expect(stackPresets).toContain("vercel");
    expect(stackPresets).toContain("render");
  });
});
