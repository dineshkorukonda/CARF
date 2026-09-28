import { describe, expect, it } from "vitest";
import {
  calculateRemainingWindow,
  shouldPollRollout,
} from "../../src/lib/useLiveRolloutPolling";

describe("useLiveRolloutPolling pure logic", () => {
  describe("shouldPollRollout", () => {
    it("returns false when rollouts list is empty", () => {
      expect(shouldPollRollout([])).toBe(false);
    });

    it("returns false when all rollouts are terminal", () => {
      const rollouts = [
        { status: "SUCCESS" },
        { status: "ROLLED_BACK" },
        { status: "FAILED" },
      ];
      expect(shouldPollRollout(rollouts)).toBe(false);
    });

    it("returns true when any rollout is PENDING", () => {
      const rollouts = [
        { status: "SUCCESS" },
        { status: "PENDING" },
      ];
      expect(shouldPollRollout(rollouts)).toBe(true);
    });
  });

  describe("calculateRemainingWindow", () => {
    it("calculates remaining seconds accurately", () => {
      const now = 1000000;
      const startedAt = new Date(now - 15000); // 15 seconds ago
      const windowSeconds = 60; // 60 seconds total

      const remaining = calculateRemainingWindow(startedAt, windowSeconds, now);
      expect(remaining).toBe(45);
    });

    it("returns 0 when observation window has expired", () => {
      const now = 1000000;
      const startedAt = new Date(now - 70000); // 70 seconds ago
      const windowSeconds = 60; // 60 seconds total

      const remaining = calculateRemainingWindow(startedAt, windowSeconds, now);
      expect(remaining).toBe(0);
    });
  });
});
