import { describe, expect, it } from "vitest";
import { pipelineSteps, rollbackDecision } from "../../src/lib/commitPipeline";

describe("rollbackDecision", () => {
  it("says rollback was necessary when the outcome is ROLLED_BACK", () => {
    expect(rollbackDecision({ hasVector: true, rolloutStatus: "ROLLED_BACK", reason: "breach" }).kind).toBe(
      "rolled_back",
    );
  });

  it("says rollback was not necessary on SUCCESS", () => {
    expect(rollbackDecision({ hasVector: true, rolloutStatus: "SUCCESS", reason: null }).kind).toBe("not_needed");
  });

  it("skips evaluation when there is no change vector", () => {
    expect(rollbackDecision({ hasVector: false, rolloutStatus: null, reason: null }).kind).toBe("no_signal");
  });

  it("does not call a classified SHA a rollout until live observation exists", () => {
    const d = rollbackDecision({ hasVector: true, rolloutStatus: null, reason: null });
    expect(d.kind).toBe("awaiting");
    expect(d.title).toBe("Not watching live yet");
  });
});

describe("pipelineSteps", () => {
  it("marks classifier steps done when a vector exists", () => {
    const steps = pipelineSteps({
      hasCommit: true,
      hasVector: true,
      hasThreshold: true,
      rolloutStatus: "SUCCESS",
    });
    expect(steps.map((s) => s.status)).toEqual(["done", "done", "done", "done", "done"]);
  });
});
