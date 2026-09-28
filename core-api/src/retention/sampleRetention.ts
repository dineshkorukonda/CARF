import type { RolloutOutcomePrismaClient } from "../adapters/rolloutOutcome.js";
import { pruneRolloutSamples } from "../adapters/rolloutOutcome.js";

export interface SampleRetentionLogger {
  info(details: Record<string, unknown>, message: string): void;
  error(details: Record<string, unknown>, message: string): void;
}

export interface SampleRetentionJobOptions {
  prismaClient: RolloutOutcomePrismaClient;
  logger: SampleRetentionLogger;
  retentionDays?: number | undefined;
  intervalMs?: number | undefined;
}

export interface SampleRetentionJob {
  timer: NodeJS.Timeout;
  stop: () => void;
  runOnce: () => Promise<number>;
  bootPromise: Promise<number>;
}

export function startSampleRetentionJob(options: SampleRetentionJobOptions): SampleRetentionJob {
  const retentionDays = options.retentionDays ?? 30;
  const intervalMs = options.intervalMs ?? 24 * 60 * 60 * 1000; // 24 hours

  const runOnce = async (): Promise<number> => {
    try {
      const count = await pruneRolloutSamples(options.prismaClient, retentionDays);
      options.logger.info({ prunedCount: count, retentionDays }, "pruned expired rollout samples");
      return count;
    } catch (error) {
      options.logger.error({ error }, "failed to prune expired rollout samples");
      return 0;
    }
  };

  // Run on boot
  const bootPromise = runOnce();

  // Schedule recurring execution with unref'd timer
  const timer = setInterval(() => {
    void runOnce();
  }, intervalMs);
  timer.unref();

  return {
    timer,
    stop: () => clearInterval(timer),
    runOnce,
    bootPromise,
  };
}
