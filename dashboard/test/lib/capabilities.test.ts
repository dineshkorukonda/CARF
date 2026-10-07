import { describe, expect, it } from "vitest";
import {
  resolveCapabilities,
  resolveFromLegacy,
  normalizeDeploymentIntegration,
  normalizeRuntimeAdapter,
} from "../../src/lib/capabilities";

describe("Centralized Capability Resolver (dashboard)", () => {
  it("resolves GitHub Actions + none to policy only with no agent required", () => {
    const res = resolveCapabilities("github_actions", "none");
    expect(res.deploymentIntegration).toBe("github_actions");
    expect(res.runtimeAdapter).toBe("none");
    expect(res.capabilities).toEqual({
      policy: true,
      monitoring: false,
      rollback: false,
    });
    expect(res.requiresAgent).toBe(false);
    expect(res.runtimeStatus).toBe("active");
  });

  it("resolves GitHub Actions + PM2 to full capabilities with direct local runtime (no agent required)", () => {
    const res = resolveCapabilities("github_actions", "pm2");
    expect(res.deploymentIntegration).toBe("github_actions");
    expect(res.runtimeAdapter).toBe("pm2");
    expect(res.capabilities).toEqual({
      policy: true,
      monitoring: true,
      rollback: true,
    });
    expect(res.requiresAgent).toBe(false);
    expect(res.runtimeStatus).toBe("active");
  });

  it("resolves GitHub Actions + Docker to full capabilities with monitoring and automated rollback", () => {
    const res = resolveCapabilities("github_actions", "docker");
    expect(res.deploymentIntegration).toBe("github_actions");
    expect(res.runtimeAdapter).toBe("docker");
    expect(res.capabilities).toEqual({
      policy: true,
      monitoring: true,
      rollback: true,
    });
    expect(res.requiresAgent).toBe(false);
    expect(res.runtimeStatus).toBe("active");
  });

  it("resolves Argo Rollouts + none to policy only", () => {
    const res = resolveCapabilities("argo_rollouts", "none");
    expect(res.deploymentIntegration).toBe("argo_rollouts");
    expect(res.capabilities.policy).toBe(true);
    expect(res.capabilities.monitoring).toBe(false);
    expect(res.capabilities.rollback).toBe(false);
    expect(res.requiresAgent).toBe(false);
  });

  it("does not claim un-implemented rollback capabilities for preview adapters (kubernetes, systemd)", () => {
    const k8s = resolveCapabilities("argo_rollouts", "kubernetes");
    expect(k8s.capabilities.policy).toBe(true);
    expect(k8s.capabilities.monitoring).toBe(false);
    expect(k8s.capabilities.rollback).toBe(false);
    expect(k8s.runtimeStatus).toBe("preview");

    const systemd = resolveCapabilities("argo_rollouts", "systemd");
    expect(systemd.capabilities.policy).toBe(true);
    expect(systemd.capabilities.monitoring).toBe(false);
    expect(systemd.capabilities.rollback).toBe(false);
    expect(systemd.runtimeStatus).toBe("roadmap");
  });

  describe("resolveFromLegacy mapping", () => {
    it("maps legacy standalone mode to github_actions + pm2", () => {
      const res = resolveFromLegacy({ mode: "standalone" });
      expect(res.deploymentIntegration).toBe("github_actions");
      expect(res.runtimeAdapter).toBe("pm2");
      expect(res.capabilities.rollback).toBe(true);
      expect(res.requiresAgent).toBe(false);
    });

    it("maps legacy standalone with adapter docker to github_actions + docker", () => {
      const res = resolveFromLegacy({ mode: "standalone", adapter: { kind: "docker" } });
      expect(res.deploymentIntegration).toBe("github_actions");
      expect(res.runtimeAdapter).toBe("docker");
      expect(res.capabilities.rollback).toBe(true);
      expect(res.requiresAgent).toBe(false);
    });

    it("maps legacy augment mode to github_actions + none", () => {
      const res = resolveFromLegacy({ mode: "augment" });
      expect(res.deploymentIntegration).toBe("github_actions");
      expect(res.runtimeAdapter).toBe("none");
      expect(res.capabilities.rollback).toBe(false);
      expect(res.requiresAgent).toBe(false);
    });

    it("does not infer runtime capabilities from repository names", () => {
      const res = resolveFromLegacy({ repo: "sahaay" });
      expect(res.deploymentIntegration).toBe("github_actions");
      expect(res.runtimeAdapter).toBe("none");
      expect(res.capabilities.rollback).toBe(false);
      expect(res.requiresAgent).toBe(false);
    });

    it("preserves explicit 3-layer architecture fields over legacy mode", () => {
      const res = resolveFromLegacy({
        mode: "standalone",
        deploymentIntegration: "argo_rollouts",
        runtimeAdapter: "none",
      });
      expect(res.deploymentIntegration).toBe("argo_rollouts");
      expect(res.runtimeAdapter).toBe("none");
    });
  });

  describe("normalization functions", () => {
    it("normalizes deployment integrations cleanly", () => {
      expect(normalizeDeploymentIntegration("GitHub-Actions")).toBe("github_actions");
      expect(normalizeDeploymentIntegration("argo-rollouts")).toBe("argo_rollouts");
      expect(normalizeDeploymentIntegration("Flagger")).toBe("flagger");
      expect(normalizeDeploymentIntegration("generic-http")).toBe("generic_http");
      expect(normalizeDeploymentIntegration("unknown")).toBe("github_actions");
    });

    it("normalizes runtime adapters cleanly", () => {
      expect(normalizeRuntimeAdapter("PM2")).toBe("pm2");
      expect(normalizeRuntimeAdapter("k8s")).toBe("kubernetes");
      expect(normalizeRuntimeAdapter("docker-engine")).toBe("docker");
      expect(normalizeRuntimeAdapter("systemd")).toBe("systemd");
      expect(normalizeRuntimeAdapter("augment")).toBe("none");
      expect(normalizeRuntimeAdapter("none")).toBe("none");
    });
  });
});
