import { describe, expect, it } from "vitest";
import {
  INSTALLATION_SECTION_ITEMS,
  installationSectionHref,
  projectCommitsHref,
  projectThresholdsHref,
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
