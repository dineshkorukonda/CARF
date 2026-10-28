import { describe, expect, it } from "vitest";
import {
  createDeploymentIntegration,
  createRuntimeAdapter,
  detectRepositoryAdapters,
} from "../../src/adapters/registry.js";

describe("Adapter Registry & Discovery (core-api)", () => {
  describe("createRuntimeAdapter factory", () => {
    it("creates PM2 runtime adapter", () => {
      const adapter = createRuntimeAdapter("pm2", "base123");
      expect(adapter.kind).toBe("pm2");
    });

    it("creates Docker runtime adapter", () => {
      const adapter = createRuntimeAdapter("docker", "image:v1");
      expect(adapter.kind).toBe("docker");
    });

    it("creates Kubernetes runtime adapter", () => {
      const adapter = createRuntimeAdapter("kubernetes", "rev1");
      expect(adapter.kind).toBe("kubernetes");
    });

    it("creates None runtime adapter for policy-only gating", () => {
      const adapter = createRuntimeAdapter("none");
      expect(adapter.kind).toBe("none");
    });
  });

  describe("createDeploymentIntegration factory", () => {
    it("creates GitHub Actions deployment integration", () => {
      const integ = createDeploymentIntegration("github_actions");
      expect(integ.kind).toBe("github_actions");
    });

    it("creates Argo Rollouts deployment integration", () => {
      const integ = createDeploymentIntegration("argo_rollouts");
      expect(integ.kind).toBe("argo_rollouts");
    });


    it("creates Generic HTTP deployment integration", () => {
      const integ = createDeploymentIntegration("generic_http");
      expect(integ.kind).toBe("generic_http");
    });
  });

  describe("detectRepositoryAdapters automatic discovery", () => {
    it("detects Docker runtime when Dockerfile or compose is present", () => {
      const result = detectRepositoryAdapters(["src/index.ts", "Dockerfile", "compose.yml"]);
      expect(result.recommendedRuntime).toBe("docker");
      expect(result.reasons).toContain("Detected Dockerfile or Docker Compose configuration");
    });

    it("detects Kubernetes and Argo Rollouts when rollout specs are present", () => {
      const result = detectRepositoryAdapters([
        ".github/workflows/deploy.yml",
        "deploy/argo-rollout.yaml",
        "kubernetes/service.yaml",
      ]);
      expect(result.recommendedIntegration).toBe("argo_rollouts");
      expect(result.recommendedRuntime).toBe("kubernetes");
    });


    it("detects GitHub Actions workflow files", () => {
      const result = detectRepositoryAdapters([
        ".github/workflows/carf-gate.yml",
        "src/server.js",
      ]);
      expect(result.recommendedIntegration).toBe("github_actions");
      expect(result.recommendedRuntime).toBe("none");
    });

    it("detects PM2 ecosystem configs", () => {
      const result = detectRepositoryAdapters([
        ".github/workflows/ci.yml",
        "ecosystem.config.cjs",
      ]);
      expect(result.recommendedIntegration).toBe("github_actions");
      expect(result.recommendedRuntime).toBe("pm2");
    });
  });
});

it("rejects removed and unknown integrations without remapping saved values", () => {
  expect(() => createDeploymentIntegration("flagger")).toThrow("Unsupported deployment integration");
  expect(() => createDeploymentIntegration("unknown")).toThrow("Unsupported deployment integration");
});
