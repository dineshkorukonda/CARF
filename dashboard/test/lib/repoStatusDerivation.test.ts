import { describe, expect, it } from "vitest";
import { deriveRepoStatus } from "../../src/lib/repoStatusDerivation";

describe("deriveRepoStatus", () => {
  it("returns 'Not connected' when repo is not configured", () => {
    expect(
      deriveRepoStatus({
        isConfigured: false,
        isVerified: false,
        totalRollouts: 0,
      })
    ).toBe("Not connected");
  });

  it("returns 'Policy Ready' for Augment mode when configured without PM2/agent", () => {
    expect(
      deriveRepoStatus({
        isConfigured: true,
        isVerified: false,
        totalRollouts: 0,
        mode: "augment",
      })
    ).toBe("Policy Ready");
  });

  it("returns 'Not verified' when repo is configured but connection check has not passed and no rollouts exist", () => {
    expect(
      deriveRepoStatus({
        isConfigured: true,
        isVerified: false,
        totalRollouts: 0,
      })
    ).toBe("Not verified");
  });

  it("returns 'Last rollout succeeded, connection unverified' when latest rollout was SUCCESS but connection is unverified", () => {
    expect(
      deriveRepoStatus({
        isConfigured: true,
        isVerified: false,
        latestOutcomeStatus: "SUCCESS",
        totalRollouts: 1,
      })
    ).toBe("Last rollout succeeded, connection unverified");
  });

  it("returns 'Connected, no rollouts yet' when verified but 0 outcomes recorded", () => {
    expect(
      deriveRepoStatus({
        isConfigured: true,
        isVerified: true,
        totalRollouts: 0,
      })
    ).toBe("Connected, no rollouts yet");
  });

  it("returns 'Observing (PENDING)' when a rollout is currently in-flight", () => {
    expect(
      deriveRepoStatus({
        isConfigured: true,
        isVerified: true,
        hasPendingRollout: true,
        latestOutcomeStatus: "PENDING",
        totalRollouts: 3,
      })
    ).toBe("Observing (PENDING)");
  });

  it("returns 'Last rollout succeeded' when latest terminal outcome is SUCCESS", () => {
    expect(
      deriveRepoStatus({
        isConfigured: true,
        isVerified: true,
        latestOutcomeStatus: "SUCCESS",
        totalRollouts: 5,
      })
    ).toBe("Last rollout succeeded");
  });

  it("returns 'Last rollout rolled back' when latest terminal outcome is ROLLED_BACK", () => {
    expect(
      deriveRepoStatus({
        isConfigured: true,
        isVerified: true,
        latestOutcomeStatus: "ROLLED_BACK",
        totalRollouts: 5,
      })
    ).toBe("Last rollout rolled back");
  });

  it("returns 'Adapter error' when latest terminal outcome is FAILED", () => {
    expect(
      deriveRepoStatus({
        isConfigured: true,
        isVerified: true,
        latestOutcomeStatus: "FAILED",
        totalRollouts: 5,
      })
    ).toBe("Adapter error");
  });

  it("never shows a healthy state without at least one terminal outcome", () => {
    const status = deriveRepoStatus({
      isConfigured: true,
      isVerified: true,
      latestOutcomeStatus: null,
      totalRollouts: 0,
    });
    expect(status).not.toBe("Last rollout succeeded");
    expect(status).toBe("Connected, no rollouts yet");
  });
});
