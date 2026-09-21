import { describe, expect, it } from "vitest";
import { INSTALLATION_SECTION_ITEMS, installationSectionHref } from "../../src/lib/dashboardNav";

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
});
