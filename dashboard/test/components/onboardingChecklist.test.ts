import { describe, it, expect } from "vitest";

describe("Onboarding Readiness Checklist", () => {
  it("calculates progress percentage based on completed steps", () => {
    const calculateProgress = (hasConfig: boolean, totalCommits: number) => {
      const steps = [
        { id: "repo-connected", completed: true },
        { id: "stack-detected", completed: true },
        { id: "config-ready", completed: hasConfig },
        { id: "first-commit", completed: totalCommits > 0 },
      ];
      const completedCount = steps.filter((s) => s.completed).length;
      return Math.round((completedCount / steps.length) * 100);
    };

    expect(calculateProgress(true, 5)).toBe(100);
    expect(calculateProgress(true, 0)).toBe(75);
    expect(calculateProgress(false, 0)).toBe(50);
  });
});
