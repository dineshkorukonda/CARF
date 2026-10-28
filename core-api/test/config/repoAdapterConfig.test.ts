import { describe, expect, it } from "vitest";
import { resolveRepoAdapterConfig } from "../../src/config/repoAdapterConfig.js";

describe("repository adapter configuration", () => {
  const fallback = { kind: "pm2" as const, target: "wrong-app" };
  it("uses the selected process and normalizes verification field names", () => {
    expect(resolveRepoAdapterConfig({ name: "Old", cwd: "/opt/app", layout: "git", releasesDir: "/releases", sharedDirs: ["/shared"] }, "Actual", fallback))
      .toEqual({ kind: "pm2", target: "Actual", cwd: "/opt/app", layout: "git", releasesRoot: "/releases", sharedPaths: ["/shared"] });
  });
  it("keeps build and probe settings from the repository instead of global settings", () => {
    expect(resolveRepoAdapterConfig({ mode: "standalone", deploymentIntegration: "github_actions", runtimeAdapter: "pm2", target: "web", buildCommand: "npm run build", healthUrl: "http://localhost:3000/health" }, undefined, fallback))
      .toMatchObject({ target: "web", buildCommand: "npm run build", healthUrl: "http://localhost:3000/health" });
  });
  it("rejects invalid saved settings rather than controlling a different app", () => {
    expect(() => resolveRepoAdapterConfig({ target: "app;echo", layout: "git" }, undefined, fallback)).toThrow();
  });
  it("supports old connections without adapter settings", () => {
    expect(resolveRepoAdapterConfig({}, undefined, fallback)).toEqual(fallback);
  });
});

it("does not infer PM2 from an ambiguous target or unknown kind", () => {
  expect(() => resolveRepoAdapterConfig({ target: "web" }, undefined, undefined)).toThrow("runtime");
  expect(() => resolveRepoAdapterConfig({ kind: "systemd", target: "web" }, undefined, undefined)).toThrow("runtime");
});

it("preserves repository-column PM2 selection with legacy target settings", () => {
  expect(resolveRepoAdapterConfig({ target: "sahaay" }, undefined, undefined, "pm2"))
    .toMatchObject({ kind: "pm2", target: "sahaay" });
});
