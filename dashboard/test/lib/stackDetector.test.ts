import { describe, it, expect } from "vitest";
import { detectStackFromRepo } from "../../src/lib/stackDetector";

describe("Stack Auto-Detector", () => {
  it("detects PM2 when ecosystem.config.js is present or repo has api/server", () => {
    const result = detectStackFromRepo("api-server", ["ecosystem.config.js", "package.json"]);
    expect(result.stack).toBe("pm2");
    expect(result.label).toContain("PM2");
    expect(result.suggestedMode).toBe("standalone");
  });

  it("detects generic stack in augment mode by default", () => {
    const result = detectStackFromRepo("my-service", ["package.json"]);
    expect(result.stack).toBe("generic");
    expect(result.suggestedMode).toBe("augment");
  });
});
