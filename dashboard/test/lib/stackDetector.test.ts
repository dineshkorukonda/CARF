import { describe, it, expect } from "vitest";
import { detectStackFromRepo } from "../../src/lib/stackDetector";

describe("Stack Auto-Detector", () => {
  it("detects Next.js / Vercel when next.config.js is present", () => {
    const result = detectStackFromRepo("my-frontend", ["next.config.js", "package.json"]);
    expect(result.stack).toBe("vercel");
    expect(result.suggestedMode).toBe("augment");
    expect(result.label).toContain("Vercel");
  });

  it("detects PM2 when ecosystem.config.js is present or repo is VersionGate", () => {
    const result = detectStackFromRepo("VersionGate", ["package.json"]);
    expect(result.stack).toBe("pm2");
    expect(result.label).toContain("PM2");
  });

  it("detects Docker Compose when docker-compose.yml is present", () => {
    const result = detectStackFromRepo("my-service", ["docker-compose.yml"]);
    expect(result.stack).toBe("docker");
    expect(result.suggestedMode).toBe("standalone");
  });

  it("detects Kubernetes when k8s manifests are present", () => {
    const result = detectStackFromRepo("k8s-cluster", ["k8s/deployment.yaml"]);
    expect(result.stack).toBe("k8s");
    expect(result.label).toContain("Kubernetes");
  });
});
