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

  it("resolves GitHub Actions + PM2 to full capabilities with agent requirement", () => {
    const res = resolveCapabilities("github_actions", "pm2");
    expect(res.deploymentIntegration).toBe("github_actions");
    expect(res.runtimeAdapter).toBe("pm2");
    expect(res.capabilities).toEqual({
      policy: true,
      monitoring: true,
      rollback: true,
    });
    expect(res.requiresAgent).toBe(true);
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

  it("does not claim un-implemented rollback capabilities for preview adapters (kubernetes, docker, systemd)", () => {
    const k8s = resolveCapabilities("argo_rollouts", "kubernetes");
    expect(k8s.capabilities.policy).toBe(true);
    expect(k8s.capabilities.monitoring).toBe(false);
    expect(k8s.capabilities.rollback).toBe(false);
    expect(k8s.runtimeStatus).toBe("preview");

    const docker = resolveCapabilities("generic_http", "docker");
    expect(docker.capabilities.policy).toBe(true);
    expect(docker.capabilities.monitoring).toBe(false);
    expect(docker.capabilities.rollback).toBe(false);
    expect(docker.runtimeStatus).toBe("preview");

    const systemd = resolveCapabilities("generic_http", "systemd");
    expect(systemd.runtimeStatus).toBe("roadmap");
  });

  it("maps legacy standalone config (e.g. Sahaay) to github_actions + pm2 with full capabilities", () => {
    const sahaay = resolveFromLegacy({
      mode: "standalone",
      adapter: { kind: "pm2" },
      storedConfig: { target: "sahaay", cwd: "/opt/sahaay/my-app" },
    });

    expect(sahaay.deploymentIntegration).toBe("github_actions");
    expect(sahaay.runtimeAdapter).toBe("pm2");
    expect(sahaay.capabilities).toEqual({
      policy: true,
      monitoring: true,
      rollback: true,
    });
  });

  it("maps legacy augment config to github_actions + none (policy-only)", () => {
    const augment = resolveFromLegacy({
      mode: "augment",
      storedConfig: { mode: "augment" },
    });

    expect(augment.deploymentIntegration).toBe("github_actions");
    expect(augment.runtimeAdapter).toBe("none");
    expect(augment.capabilities).toEqual({
      policy: true,
      monitoring: false,
      rollback: false,
    });
  });

  it("normalizes variants of strings cleanly", () => {
    expect(normalizeDeploymentIntegration("GitHub-Actions")).toBe("github_actions");
    expect(normalizeDeploymentIntegration("argo")).toBe("argo_rollouts");
    expect(normalizeDeploymentIntegration("api")).toBe("generic_http");
    expect(normalizeRuntimeAdapter("no_direct_runtime_integration")).toBe("none");
    expect(normalizeRuntimeAdapter("k8s")).toBe("kubernetes");
    expect(normalizeRuntimeAdapter("docker-compose")).toBe("docker");
  });
});
