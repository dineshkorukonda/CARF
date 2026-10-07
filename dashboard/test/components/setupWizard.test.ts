import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../../src/lib/capabilities";

describe("SetupWizard 3-layer architecture resolution", () => {
  it("resolves capabilities correctly for GitHub Actions + None (zero agent)", () => {
    const resolved = resolveCapabilities("github_actions", "none");
    expect(resolved.deploymentIntegration).toBe("github_actions");
    expect(resolved.runtimeAdapter).toBe("none");
    expect(resolved.capabilities.policy).toBe(true);
    expect(resolved.capabilities.monitoring).toBe(false);
    expect(resolved.capabilities.rollback).toBe(false);
    expect(resolved.requiresAgent).toBe(false);
    expect(resolved.integrationLabel).toBe("GitHub Actions");
    expect(resolved.runtimeLabel).toBe("No direct runtime integration (Policy only)");
  });

  it("resolves capabilities correctly for GitHub Actions + PM2 (active rollback & direct local runtime)", () => {
    const resolved = resolveCapabilities("github_actions", "pm2");
    expect(resolved.deploymentIntegration).toBe("github_actions");
    expect(resolved.runtimeAdapter).toBe("pm2");
    expect(resolved.capabilities.policy).toBe(true);
    expect(resolved.capabilities.monitoring).toBe(true);
    expect(resolved.capabilities.rollback).toBe(true);
    expect(resolved.requiresAgent).toBe(false);
    expect(resolved.runtimeStatus).toBe("active");
  });

  it("resolves capabilities for Argo Rollouts + None", () => {
    const resolved = resolveCapabilities("argo_rollouts", "none");
    expect(resolved.deploymentIntegration).toBe("argo_rollouts");
    expect(resolved.runtimeAdapter).toBe("none");
    expect(resolved.capabilities.policy).toBe(true);
    expect(resolved.capabilities.rollback).toBe(false);
    expect(resolved.requiresAgent).toBe(false);
  });

  it("resolves Docker to active capabilities with monitoring and rollback", () => {
    const resolvedDocker = resolveCapabilities("github_actions", "docker");
    expect(resolvedDocker.runtimeStatus).toBe("active");
    expect(resolvedDocker.capabilities.monitoring).toBe(true);
    expect(resolvedDocker.capabilities.rollback).toBe(true);
  });

  it("marks roadmap adapters as preview without claiming live rollback", () => {
    const resolvedK8s = resolveCapabilities("argo_rollouts", "kubernetes");
    expect(resolvedK8s.runtimeStatus).toBe("preview");
    expect(resolvedK8s.capabilities.rollback).toBe(false);

    const resolvedSystemd = resolveCapabilities("generic_http", "systemd");
    expect(resolvedSystemd.runtimeStatus).toBe("roadmap");
    expect(resolvedSystemd.capabilities.rollback).toBe(false);
  });
});
