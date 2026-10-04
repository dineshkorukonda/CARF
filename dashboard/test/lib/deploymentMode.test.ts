import { describe, it, expect } from "vitest";
import {
  resolveRepoMode,
  resolveAugmentIntegration,
  isStandaloneRepo,
  isAugmentRepo,
  isAccidentalProductionRepoName,
  parseDeclaredMode,
} from "../../src/lib/deploymentMode";

describe("deploymentMode resolution", () => {
  it("defaults to standalone when input is empty or null", () => {
    expect(resolveRepoMode(null)).toBe("standalone");
    expect(resolveRepoMode(undefined)).toBe("standalone");
    expect(resolveRepoMode({})).toBe("standalone");
  });

  it("treats RepoConnection.mode as authoritative over storedConfig", () => {
    expect(
      resolveRepoMode({
        mode: "augment",
        storedConfig: { mode: "standalone", target: "sahaay" },
      })
    ).toBe("augment");
    expect(
      resolveRepoMode({
        mode: "standalone",
        storedConfig: { mode: "augment", integration: "github-actions" },
      })
    ).toBe("standalone");
  });

  it("recognizes explicit mode string", () => {
    expect(resolveRepoMode({ mode: "augment" })).toBe("augment");
    expect(resolveRepoMode({ mode: "standalone" })).toBe("standalone");
  });

  it("identifies Augment from storedConfig.mode", () => {
    expect(resolveRepoMode({ storedConfig: { mode: "augment" } })).toBe("augment");
  });

  it("identifies Augment from storedConfig.integration", () => {
    expect(resolveRepoMode({ storedConfig: { integration: "github-actions" } })).toBe("augment");
    expect(resolveRepoMode({ storedConfig: { integration: "argo-rollouts" } })).toBe("augment");
  });

  it("correctly preserves legacy Standalone repos like Sahaay", () => {
    const sahaayConfig = {
      target: "sahaay",
      cwd: "/opt/sahaay/my-app",
      layout: "git",
      healthUrl: "http://127.0.0.1:3000/api/health",
    };
    expect(resolveRepoMode({ storedConfig: sahaayConfig })).toBe("standalone");
    expect(isStandaloneRepo({ storedConfig: sahaayConfig })).toBe(true);
    expect(isAugmentRepo({ storedConfig: sahaayConfig })).toBe(false);
  });

  it("resolves augment integration types", () => {
    expect(resolveAugmentIntegration(null)).toBe("github-actions");
    expect(
      resolveAugmentIntegration({ storedConfig: { integration: "argo-rollouts" } })
    ).toBe("argo-rollouts");
    expect(
      resolveAugmentIntegration({ storedConfig: { integration: "flagger" } })
    ).toBe("flagger");
    expect(
      resolveAugmentIntegration({ storedConfig: { integration: "generic" } })
    ).toBe("generic-http");
    expect(
      resolveAugmentIntegration({ storedConfig: { integration: "generic-http" } })
    ).toBe("generic-http");
    expect(
      resolveAugmentIntegration({ deploymentIntegration: "github_actions" })
    ).toBe("github-actions");
    expect(
      resolveAugmentIntegration({ deploymentIntegration: "argo_rollouts" })
    ).toBe("argo-rollouts");
    expect(
      resolveAugmentIntegration({ deploymentIntegration: "flagger" })
    ).toBe("flagger");
    expect(
      resolveAugmentIntegration({ deploymentIntegration: "generic_http" })
    ).toBe("generic-http");
  });

  it("accepts only standalone and augment as declared modes", () => {
    expect(parseDeclaredMode("standalone")).toBe("standalone");
    expect(parseDeclaredMode("augment")).toBe("augment");
    expect(parseDeclaredMode("balanced")).toBeNull();
    expect(parseDeclaredMode("conservative")).toBeNull();
    expect(parseDeclaredMode("aggressive")).toBeNull();
    expect(parseDeclaredMode("production")).toBeNull();
  });

  it("does not treat the word production as a special repository", () => {
    expect(isAccidentalProductionRepoName("production")).toBe(true);
    expect(isAccidentalProductionRepoName("Sahaay")).toBe(false);
    expect(resolveRepoMode({ storedConfig: { target: "production" } })).toBe("standalone");
  });
});
