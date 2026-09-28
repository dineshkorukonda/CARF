import { describe, it, expect } from "vitest";
import { detectStackFromRepo } from "../../src/lib/stackDetector";

describe("Stack Auto-Detector", () => {
  it("detects Next.js when next.config.js is present", () => {
    const result = detectStackFromRepo("my-frontend", ["next.config.js", "package.json"]);
    expect(result.stack).toBe("nextjs");
    expect(result.suggestedMode).toBe("augment");
    expect(result.label).toContain("Next.js");
  });

  it("detects PM2 when ecosystem.config.js is present or repo is VersionGate", () => {
    const result = detectStackFromRepo("VersionGate", ["package.json"]);
    expect(result.stack).toBe("pm2");
    expect(result.label).toContain("PM2");
    expect(result.suggestedMode).toBe("standalone");
  });

  it("detects Docker when docker-compose.yml is present", () => {
    const result = detectStackFromRepo("my-service", ["docker-compose.yml"]);
    expect(result.stack).toBe("docker");
    expect(result.suggestedMode).toBe("augment");
  });

  it("detects generic stack in augment mode by default", () => {
    const result = detectStackFromRepo("my-service", ["package.json"]);
    expect(result.stack).toBe("generic");
    expect(result.suggestedMode).toBe("augment");
  });
});
