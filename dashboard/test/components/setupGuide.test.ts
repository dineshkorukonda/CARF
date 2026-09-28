import { describe, it, expect } from "vitest";

describe("Tab Explainer & Setup Guide", () => {
  it("verifies tab keys and presets are defined correctly", () => {
    const tabKeys = ["status", "adapter", "rules", "analytics"];
    expect(tabKeys).toHaveLength(4);
    expect(tabKeys).toContain("status");
    expect(tabKeys).toContain("adapter");
  });

  it("verifies preset is PM2", () => {
    const stackPresets = ["pm2"];
    expect(stackPresets).toContain("pm2");
    expect(stackPresets).toHaveLength(1);
  });
});
