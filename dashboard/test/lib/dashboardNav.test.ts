import { describe, expect, it } from "vitest";
import {
  INSTALLATION_SECTION_ITEMS,
  installationSectionHref,
  projectCommitsHref,
  projectThresholdsHref,
  DASHBOARD_NAV_ITEMS,
  THRESHOLD_DEMO_HREF,
  repoSetupHref,
  projectPageHref,
  projectSectionHref,
  commitPageHref,
} from "../../src/lib/dashboardNav";

describe("installation chrome", () => {
  it("exposes Live Status, Rollout Analytics, and Integrations only", () => {
    expect(INSTALLATION_SECTION_ITEMS.map((item) => item.label)).toEqual([
      "Live Status",
      "Rollout Analytics",
      "Integrations",
    ]);
  });

  it("does not treat adapter or threshold as installation destinations", () => {
    const labels = INSTALLATION_SECTION_ITEMS.map((item) => item.label.toLowerCase());
    expect(labels.some((label) => label.includes("adapter"))).toBe(false);
    expect(labels.some((label) => label.includes("threshold"))).toBe(false);
  });

  it("builds section hrefs under status, analytics, and integrations", () => {
    expect(installationSectionHref("status", "42")).toBe("/dashboard/status/42");
    expect(installationSectionHref("analytics", "42")).toBe("/dashboard/analytics/42");
    expect(installationSectionHref("integrations", "42")).toBe("/dashboard/integrations/42");
  });

  it("never routes installation chrome through /config", () => {
    const hrefs = INSTALLATION_SECTION_ITEMS.map((item) => installationSectionHref(item.id, "99"));
    expect(hrefs.every((href) => !href.includes("/config"))).toBe(true);
  });
});

describe("projectThresholdsHref", () => {
  it("keeps the selected repo in the rules URL", () => {
    expect(projectThresholdsHref("42", "acme/api")).toBe(
      "/dashboard/config/42/rules?repo=acme%2Fapi"
    );
  });

  it("encodes unusual repo names", () => {
    expect(projectThresholdsHref("7", "org/my repo+v2")).toBe(
      "/dashboard/config/7/rules?repo=org%2Fmy%20repo%2Bv2"
    );
  });

  it("returns null when installation or repo is missing", () => {
    expect(projectThresholdsHref("", "acme/api")).toBeNull();
    expect(projectThresholdsHref("42", "")).toBeNull();
    expect(projectThresholdsHref("42", "   ")).toBeNull();
  });
});

describe("projectCommitsHref", () => {
  it("returns the project live-status URL with repo context", () => {
    expect(projectCommitsHref("42", "acme/api")).toBe("/dashboard/status/42?repo=acme%2Fapi");
  });

  it("returns null without a repo so callers cannot drop project context", () => {
    expect(projectCommitsHref("42", "")).toBeNull();
  });
});

describe("repo onboarding hrefs", () => {
  it("scopes setup to the selected repository", () => {
    expect(repoSetupHref("dineshkorukonda", "Sahaay")).toBe(
      "/dashboard/setup?repo=dineshkorukonda%2FSahaay"
    );
  });

  it("opens an already-linked repo in edit mode instead of a fresh onboarding", () => {
    expect(repoSetupHref("dineshkorukonda", "Sahaay", { edit: true })).toBe(
      "/dashboard/setup?repo=dineshkorukonda%2FSahaay&edit=1"
    );
  });

  it("opens rollouts on the project page", () => {
    expect(projectPageHref("dineshkorukonda", "Sahaay")).toBe("/dashboard/repos/dineshkorukonda/Sahaay");
  });

  it("keeps project sections scoped to the selected repository", () => {
    expect(projectSectionHref("acme", "api", "overview")).toBe("/dashboard/repos/acme/api");
    expect(projectSectionHref("acme", "api", "commits")).toBe("/dashboard/repos/acme/api?view=commits");
    expect(projectSectionHref("acme", "api", "settings")).toBe("/dashboard/repos/acme/api?view=settings");
  });

  it("opens a per-commit pipeline page", () => {
    expect(commitPageHref("dineshkorukonda", "Sahaay", "abc123def")).toBe(
      "/dashboard/commits/dineshkorukonda/Sahaay/abc123def",
    );
    expect(THRESHOLD_DEMO_HREF).toBe("/dashboard/verify");
  });

  it("keeps the global sidebar to repositories and GitHub App / Integrations", () => {
    expect(DASHBOARD_NAV_ITEMS.map((item) => item.label)).toEqual([
      "Repositories",
      "GitHub App / Integrations",
    ]);
    expect(DASHBOARD_NAV_ITEMS.some((item) => item.label.includes("Demo"))).toBe(false);
    expect(DASHBOARD_NAV_ITEMS.map((item) => item.href)).toEqual([
      "/dashboard",
      "/dashboard/settings",
    ]);
  });
});
