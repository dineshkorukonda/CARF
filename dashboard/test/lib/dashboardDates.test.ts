import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createDashboardDates } from "../../src/lib/dashboardDates";
import { useDashboardDates } from "../../src/lib/useDashboardDates";

describe("dashboard timestamps", () => {
  it("renders a timezone-neutral placeholder on the server", () => {
    function Timestamp() {
      return createElement("time", null, useDashboardDates().dateTime("2026-10-05T05:30:00Z"));
    }
    expect(renderToString(createElement(Timestamp))).toBe("<time>—</time>");
  });

  it("uses the same local calendar day for labels and chart buckets", () => {
    const dates = createDashboardDates("Asia/Kolkata");
    const timestamp = "2026-10-05T23:45:00Z";
    expect(dates.dateTime(timestamp)).toContain("06 Oct 2026");
    expect(dates.time(timestamp)).toContain("05:15:00");
    expect(dates.dayKey(timestamp)).toBe("2026-10-06");
    expect(dates.recentDays(2, new Date(timestamp))).toEqual(["2026-10-05", "2026-10-06"]);
  });

  it("respects zones behind UTC rather than bucketing by UTC day", () => {
    const dates = createDashboardDates("America/Los_Angeles");
    const timestamp = "2026-10-05T01:00:00Z";
    expect(dates.dayKey(timestamp)).toBe("2026-10-04");
    expect(dates.dateTime(timestamp)).toContain("04 Oct 2026");
    expect(dates.time(timestamp)).toContain("18:00:00");
  });

  it("distinguishes repeated clock times at the DST boundary by their zone offset", () => {
    const dates = createDashboardDates("America/New_York");
    const before = dates.time("2026-11-01T05:30:00Z");
    const after = dates.time("2026-11-01T06:30:00Z");
    expect(before).toContain("01:30:00");
    expect(after).toContain("01:30:00");
    expect(before).not.toBe(after);
    expect(dates.recentDays(3, new Date("2026-03-09T04:30:00Z"))).toEqual(["2026-03-07", "2026-03-08", "2026-03-09"]);
  });

  it("does not invent UTC labels while the browser zone is unavailable", () => {
    const dates = createDashboardDates(null);
    expect(dates.dateTime("2026-10-05T05:30:00Z")).toBe("—");
    expect(dates.dayKey("2026-10-05T05:30:00Z")).toBe("");
    expect(dates.recentDays(14)).toEqual([]);
  });

  it("handles missing and invalid values consistently", () => {
    const dates = createDashboardDates("UTC");
    expect(dates.date(null)).toBe("—");
    expect(dates.time("invalid")).toBe("—");
    expect(dates.dayKey(undefined)).toBe("");
    expect(dates.dateTime("2026-10-05T05:30:00Z")).toBe(dates.dateTime(new Date("2026-10-05T05:30:00Z")));
  });
});
