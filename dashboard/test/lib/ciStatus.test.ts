import { describe, expect, it } from "vitest";
import { commitCiStage, ciIsActive, type CiSnapshot } from "../../src/lib/ciStatus";

describe("CI status during a push burst", () => {
  const snapshot: CiSnapshot = { headSha: "new", unavailable: false, runs: {
    old: { id: 1, status: "completed", conclusion: "success", url: "" },
    broken: { id: 2, status: "completed", conclusion: "failure", url: "" },
    cancelled: { id: 3, status: "completed", conclusion: "cancelled", url: "" },
    new: { id: 4, status: "in_progress", conclusion: null, url: "" },
  } };
  it("distinguishes failed, cancelled, superseded and active commits", () => {
    expect(commitCiStage("old", snapshot)).toBe("Superseded");
    expect(commitCiStage("broken", snapshot)).toBe("CI failed");
    expect(commitCiStage("cancelled", snapshot)).toBe("CI cancelled");
    expect(commitCiStage("new", snapshot)).toBe("CI running");
    expect(ciIsActive(snapshot)).toBe(true);
  });
  it("never calls unknown or failed CI waiting", () => {
    expect(commitCiStage("new")).toBe("CI status unavailable");
    expect(commitCiStage("new", { ...snapshot, unavailable: true })).toBe("CI status unavailable");
    expect(ciIsActive({ ...snapshot, headSha: "broken", runs: { broken: snapshot.runs.broken } })).toBe(false);
  });
  it("shows a failed deployment after successful CI", () => {
    expect(commitCiStage("old", { ...snapshot, headSha: "old", deployments: {
      old: { id: 5, status: "completed", conclusion: "failure", url: "" },
    } })).toBe("Deployment failed");
  });
});
