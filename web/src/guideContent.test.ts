import { describe, expect, it } from "vitest";
import { GUIDE_PLATFORMS, GETTING_STARTED } from "./guideContent";

describe("getting started for a normal project", () => {
  it("covers account, GitHub App, linking, and first push", () => {
    const titles = GETTING_STARTED.steps.map((step) => step.title.toLowerCase());
    expect(titles.some((t) => t.includes("account"))).toBe(true);
    expect(titles.some((t) => t.includes("github"))).toBe(true);
    expect(titles.some((t) => t.includes("link"))).toBe(true);
    expect(titles.some((t) => t.includes("push") || t.includes("commit"))).toBe(true);
  });

  it("does not require a specific adapter before the project is linked", () => {
    expect(GETTING_STARTED.mode).toBe("any");
    expect(GETTING_STARTED.steps.every((step) => !/pm2|vercel/i.test(step.body))).toBe(true);
  });
});

describe("platform integration guides", () => {
  it("documents every current dashboard integration", () => {
    expect(GUIDE_PLATFORMS.map((p) => p.id)).toEqual([
      "pm2",
      "vercel",
      "render",
      "docker",
      "kubernetes",
      "prometheus",
    ]);
  });

  it("marks PM2 and Docker as standalone adapters", () => {
    expect(GUIDE_PLATFORMS.find((p) => p.id === "pm2")?.mode).toBe("standalone");
    expect(GUIDE_PLATFORMS.find((p) => p.id === "docker")?.mode).toBe("standalone");
  });

  it("marks Vercel, Render, and Kubernetes as augment integrations", () => {
    expect(GUIDE_PLATFORMS.find((p) => p.id === "vercel")?.mode).toBe("augment");
    expect(GUIDE_PLATFORMS.find((p) => p.id === "render")?.mode).toBe("augment");
    expect(GUIDE_PLATFORMS.find((p) => p.id === "kubernetes")?.mode).toBe("augment");
  });

  it("includes copyable .carf.yml with the right adapter kind for standalone platforms", () => {
    const pm2 = GUIDE_PLATFORMS.find((p) => p.id === "pm2")!;
    const docker = GUIDE_PLATFORMS.find((p) => p.id === "docker")!;
    expect(pm2.carfYml).toMatch(/kind:\s*pm2/);
    expect(docker.carfYml).toMatch(/kind:\s*dockerCompose/);
  });

  it("includes a Vercel threshold probe instead of a local adapter", () => {
    const vercel = GUIDE_PLATFORMS.find((p) => p.id === "vercel")!;
    expect(vercel.carfYml).toMatch(/mode:\s*augment/);
    expect(vercel.carfYml).not.toMatch(/adapter:/);
    expect(vercel.deploySnippet).toContain("/v1/threshold");
  });

  it("returns null for an unknown platform id", () => {
    expect(GUIDE_PLATFORMS.find((p) => p.id === "unknown")).toBeUndefined();
  });
});
