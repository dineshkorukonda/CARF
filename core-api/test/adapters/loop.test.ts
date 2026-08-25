import { describe, expect, it, vi } from "vitest";
import { runStandaloneLoop } from "../../src/adapters/loop.js";
import type { RollbackAdapter } from "../../src/adapters/rollbackAdapter.js";
import type { ThresholdResult } from "../../src/threshold/engine.js";

function mockAdapter(overrides: Partial<RollbackAdapter> = {}): RollbackAdapter {
  return {
    checkHealth: vi.fn().mockResolvedValue({ errorRate: 0, healthy: true }),
    rollback: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function threshold(overrides: Partial<ThresholdResult> = {}): ThresholdResult {
  return {
    finalThreshold: 0.05,
    finalWindow: 30,
    activeTypes: ["config"],
    ...overrides,
  };
}

describe("runStandaloneLoop", () => {
  it("polls for the full window and does not roll back when health stays good", async () => {
    const adapter = mockAdapter({
      checkHealth: vi.fn().mockResolvedValue({ errorRate: 0.01, healthy: true }),
    });
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await runStandaloneLoop("sha123", adapter, threshold({ finalWindow: 30 }), "my-service", {
      pollIntervalMs: 10_000,
      sleep,
    });

    expect(result).toEqual({ rolledBack: false, finalErrorRate: 0.01, durationMs: 30_000 });
    expect(adapter.rollback).not.toHaveBeenCalled();
    // 30s window / 10s interval = 3 polls
    expect(adapter.checkHealth).toHaveBeenCalledTimes(3);
    expect(adapter.checkHealth).toHaveBeenCalledWith("my-service");
  });

  it("reports the actual accumulated elapsed time as durationMs, not the nominal window, when the window doesn't evenly divide the poll interval", async () => {
    const adapter = mockAdapter({
      checkHealth: vi.fn().mockResolvedValue({ errorRate: 0.01, healthy: true }),
    });
    const sleep = vi.fn().mockResolvedValue(undefined);

    // 25s window / 10s interval: checks at elapsedMs 0, 10000, 20000 -- the loop's own
    // accounting increments elapsedMs to 30000 after the 3rd check before re-testing the
    // while condition, so the real accumulated value the loop worked with is 30000, not
    // the configured 25000.
    const result = await runStandaloneLoop("sha123", adapter, threshold({ finalWindow: 25 }), "my-service", {
      pollIntervalMs: 10_000,
      sleep,
    });

    expect(adapter.checkHealth).toHaveBeenCalledTimes(3);
    expect(result.durationMs).toBe(30_000);
  });

  it("rolls back and exits early as soon as the error rate breaches the threshold", async () => {
    const adapter = mockAdapter({
      checkHealth: vi
        .fn()
        .mockResolvedValueOnce({ errorRate: 0.01, healthy: true })
        .mockResolvedValueOnce({ errorRate: 0.2, healthy: false }),
    });
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await runStandaloneLoop(
      "sha123",
      adapter,
      threshold({ finalThreshold: 0.05, finalWindow: 30 }),
      "my-service",
      { pollIntervalMs: 10_000, sleep }
    );

    expect(result).toEqual({ rolledBack: true, finalErrorRate: 0.2, durationMs: 10_000 });
    expect(adapter.rollback).toHaveBeenCalledTimes(1);
    expect(adapter.rollback).toHaveBeenCalledWith("my-service");
    // stopped after the 2nd poll, never reached a 3rd
    expect(adapter.checkHealth).toHaveBeenCalledTimes(2);
  });

  it("polls more times with a smaller configured interval, for the same window", async () => {
    const adapter = mockAdapter();
    const sleep = vi.fn().mockResolvedValue(undefined);

    await runStandaloneLoop("sha123", adapter, threshold({ finalWindow: 20 }), "svc", {
      pollIntervalMs: 5_000,
      sleep,
    });

    // 20s window / 5s interval = 4 polls
    expect(adapter.checkHealth).toHaveBeenCalledTimes(4);
  });

  it("polls fewer times with a larger configured interval, for the same window", async () => {
    const adapter = mockAdapter();
    const sleep = vi.fn().mockResolvedValue(undefined);

    await runStandaloneLoop("sha123", adapter, threshold({ finalWindow: 20 }), "svc", {
      pollIntervalMs: 10_000,
      sleep,
    });

    // 20s window / 10s interval = 2 polls
    expect(adapter.checkHealth).toHaveBeenCalledTimes(2);
  });

  it("uses the injected sleep function between polls, not real wall-clock time", async () => {
    const adapter = mockAdapter();
    const sleep = vi.fn().mockResolvedValue(undefined);

    await runStandaloneLoop("sha123", adapter, threshold({ finalWindow: 20 }), "svc", {
      pollIntervalMs: 10_000,
      sleep,
    });

    expect(sleep).toHaveBeenCalledWith(10_000);
  });
});
