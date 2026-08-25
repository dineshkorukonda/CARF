import type { ThresholdResult } from "../threshold/engine.js";
import type { RollbackAdapter } from "./rollbackAdapter.js";

function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface StandaloneLoopOptions {
  /** Interval between health checks, in milliseconds. Defaults to 5000ms. */
  pollIntervalMs?: number;
  /** Injectable delay function so tests don't wait on real wall-clock time. */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_POLL_INTERVAL_MS = 5_000;

/**
 * Polls `adapter.checkHealth(target)` at `pollIntervalMs` intervals until
 * `threshold.finalWindow` (seconds) has elapsed. If the reported error rate ever
 * breaches `threshold.finalThreshold`, immediately triggers `adapter.rollback(target)`
 * and returns without waiting out the rest of the window.
 *
 * `sha` identifies the commit under evaluation; it isn't passed to the adapter today
 * but is accepted so callers/adapters can log/correlate against it going forward.
 */
export interface StandaloneLoopResult {
  rolledBack: boolean;
  /** The last error rate observed from checkHealth() before the loop returned. */
  finalErrorRate: number;
  /** How long the loop actually ran, in milliseconds -- less than the full window if it rolled back early. */
  durationMs: number;
}

export async function runStandaloneLoop(
  sha: string,
  adapter: RollbackAdapter,
  threshold: ThresholdResult,
  target: string,
  options: StandaloneLoopOptions = {}
): Promise<StandaloneLoopResult> {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const sleep = options.sleep ?? realSleep;
  const windowMs = threshold.finalWindow * 1000;

  let elapsedMs = 0;
  let lastErrorRate = 0;
  while (elapsedMs < windowMs) {
    const health = await adapter.checkHealth(target);
    lastErrorRate = health.errorRate;

    if (health.errorRate >= threshold.finalThreshold) {
      await adapter.rollback(target);
      return { rolledBack: true, finalErrorRate: lastErrorRate, durationMs: elapsedMs };
    }

    elapsedMs += pollIntervalMs;
    if (elapsedMs < windowMs) {
      await sleep(pollIntervalMs);
    }
  }

  return { rolledBack: false, finalErrorRate: lastErrorRate, durationMs: elapsedMs };
}
