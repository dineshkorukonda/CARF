import { describe, expect, it } from "vitest";
import { INSTALLATION_SECTION_ITEMS, installationSectionHref, DASHBOARD_NAV_ITEMS } from "../../src/lib/dashboardNav";

describe("installation chrome must stay project-scoped", () => {
  it("does not revive Deployment Adapter or Threshold Rules as sibling installation tabs", () => {
    const labels = INSTALLATION_SECTION_ITEMS.map((item) => item.label);
    expect(labels).not.toContain("Deployment Adapter");
    expect(labels).not.toContain("Threshold Rules");
  });

  it("keeps adapter configuration off the installation destination list", () => {
    const hrefs = INSTALLATION_SECTION_ITEMS.map((item) => installationSectionHref(item.id, "1"));
    expect(hrefs.some((href) => href.includes("/config"))).toBe(false);
  });

  it("keeps PM2 setup and rollouts off the global sidebar; those are repo onboarding and project views", () => {
    const labels = DASHBOARD_NAV_ITEMS.map((item) => item.label);
    expect(labels).not.toContain("PM2 Setup");
    expect(labels).not.toContain("Rollouts & Controls");
    expect(DASHBOARD_NAV_ITEMS.map((item) => item.href)).not.toContain("/dashboard/setup");
  });
});
