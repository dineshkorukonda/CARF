import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { startSampleRetentionJob } from "../../src/retention/sampleRetention.js";
import type { RolloutOutcomePrismaClient } from "../../src/adapters/rolloutOutcome.js";

describe("Sample Retention Scheduled Job", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prunes samples immediately on boot and every 24 hours via unref'd timer", async () => {
    const deleteManyMock = vi.fn().mockResolvedValue({ count: 12 });
    const mockPrisma = {
      rolloutSample: {
        deleteMany: deleteManyMock,
      },
    } as unknown as RolloutOutcomePrismaClient;

    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    const job = startSampleRetentionJob({
      prismaClient: mockPrisma,
      logger,
      retentionDays: 30,
      intervalMs: 24 * 60 * 60 * 1000,
    });

    // 1. Await boot run
    await job.bootPromise;
    expect(deleteManyMock).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ prunedCount: 12, retentionDays: 30 }),
      expect.stringContaining("pruned expired rollout samples")
    );

    // 2. Advance 24 hours -> runs second time
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(deleteManyMock).toHaveBeenCalledTimes(2);

    // 3. Advance another 24 hours -> runs third time
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(deleteManyMock).toHaveBeenCalledTimes(3);

    // 4. Stop clears timer
    job.stop();
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    expect(deleteManyMock).toHaveBeenCalledTimes(3);
  });

  it("handles errors during pruning without unhandled rejection", async () => {
    const deleteManyMock = vi.fn().mockRejectedValue(new Error("DB connection timeout"));
    const mockPrisma = {
      rolloutSample: {
        deleteMany: deleteManyMock,
      },
    } as unknown as RolloutOutcomePrismaClient;

    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    const job = startSampleRetentionJob({
      prismaClient: mockPrisma,
      logger,
    });

    await job.bootPromise;
    expect(deleteManyMock).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(Error) }),
      expect.stringContaining("failed to prune")
    );

    job.stop();
  });
});
