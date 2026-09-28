import { describe, expect, it, vi } from "vitest";
import type { RollbackAdapter } from "../../src/adapters/rollbackAdapter.js";
import type { RolloutOutcomePrismaClient, RolloutOutcomeRecord } from "../../src/adapters/rolloutOutcome.js";
import { RolloutMonitor } from "../../src/monitor/rolloutMonitor.js";

function createFakePrisma(initialOutcomes: RolloutOutcomeRecord[] = []): RolloutOutcomePrismaClient & { outcomes: Map<string, RolloutOutcomeRecord> } {
  const outcomes = new Map<string, RolloutOutcomeRecord>();
  for (const outcome of initialOutcomes) {
    outcomes.set(outcome.id, { ...outcome });
  }

  return {
    outcomes,
    rolloutOutcome: {
      async findMany(args) {
        let list = Array.from(outcomes.values());
        if (args?.where?.status) {
          list = list.filter((o) => o.status === args.where!.status);
        }
        return list;
      },
      async upsert(args) {
        const key = `${args.create.installationId ?? ""}::${args.create.commitSha}`;
        for (const existing of outcomes.values()) {
          if ((existing.installationId ?? "") === (args.create.installationId ?? "") && existing.commitSha === args.create.commitSha) {
            existing.threshold = args.update.threshold ?? existing.threshold;
            existing.window = args.update.window ?? existing.window;
            return existing;
          }
        }
        const newRecord: RolloutOutcomeRecord = {
          id: `outcome-${outcomes.size + 1}`,
          owner: args.create.owner,
          repo: args.create.repo,
          commitSha: args.create.commitSha,
          installationId: args.create.installationId,
          status: args.create.status,
          threshold: args.create.threshold,
          window: args.create.window,
          startedAt: args.create.startedAt ?? new Date(),
          rolledBack: args.create.rolledBack ?? false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        outcomes.set(newRecord.id, newRecord);
        return newRecord;
      },
      async update(args) {
        const existing = outcomes.get(args.where.id);
        if (!existing) {
          throw new Error(`Record ${args.where.id} not found`);
        }
        Object.assign(existing, args.data, { updatedAt: new Date() });
        return existing;
      },
    },
  };
}

describe("RolloutMonitor State Machine", () => {
  const fakeLogger = {
    info: vi.fn(),
    error: vi.fn(),
  };

  it("transitions PENDING -> SUCCESS when soak window expires with errorRate < threshold", async () => {
    let currentTime = 1000;
    const fakePrisma = createFakePrisma();
    const outcome: RolloutOutcomeRecord = {
      id: "outcome-1",
      commitSha: "sha123",
      status: "PENDING",
      threshold: 0.05,
      window: 10, // 10 seconds
      startedAt: new Date(currentTime),
      rolledBack: false,
      createdAt: new Date(currentTime),
      updatedAt: new Date(currentTime),
    };
    fakePrisma.outcomes.set(outcome.id, outcome);

    const checkHealth = vi.fn().mockResolvedValue({ errorRate: 0.01, healthy: true });
    const rollback = vi.fn().mockResolvedValue(undefined);
    const adapter: RollbackAdapter = { checkHealth, rollback };

    const sleep = vi.fn().mockImplementation(async (ms: number) => {
      currentTime += ms;
    });

    const monitor = new RolloutMonitor({
      prismaClient: fakePrisma,
      logger: fakeLogger,
      pollIntervalMs: 2000,
      sleep,
      now: () => new Date(currentTime),
    });

    monitor.enqueue(outcome, adapter);
    await monitor.waitForJobs();

    const finalized = fakePrisma.outcomes.get("outcome-1")!;
    expect(finalized.status).toBe("SUCCESS");
    expect(finalized.rolledBack).toBe(false);
    expect(finalized.finalErrorRate).toBe(0.01);
    expect(rollback).not.toHaveBeenCalled();
  });

  it("transitions PENDING -> ROLLED_BACK when errorRate >= threshold, calls rollback and records verification", async () => {
    let currentTime = 1000;
    const fakePrisma = createFakePrisma();
    const outcome: RolloutOutcomeRecord = {
      id: "outcome-2",
      commitSha: "sha456",
      status: "PENDING",
      threshold: 0.05,
      window: 30,
      startedAt: new Date(currentTime),
      rolledBack: false,
      createdAt: new Date(currentTime),
      updatedAt: new Date(currentTime),
    };
    fakePrisma.outcomes.set(outcome.id, outcome);

    const checkHealth = vi
      .fn()
      .mockResolvedValueOnce({ errorRate: 0.01, healthy: true })
      .mockResolvedValueOnce({ errorRate: 0.12, healthy: false });
    const rollbackWithVerification = vi.fn().mockResolvedValue({ rollbackVerified: true });
    const adapter: RollbackAdapter = { checkHealth, rollback: vi.fn(), rollbackWithVerification };

    const sleep = vi.fn().mockImplementation(async (ms: number) => {
      currentTime += ms;
    });

    const monitor = new RolloutMonitor({
      prismaClient: fakePrisma,
      logger: fakeLogger,
      pollIntervalMs: 2000,
      sleep,
      now: () => new Date(currentTime),
    });

    monitor.enqueue(outcome, adapter);
    await monitor.waitForJobs();

    const finalized = fakePrisma.outcomes.get("outcome-2")!;
    expect(finalized.status).toBe("ROLLED_BACK");
    expect(finalized.rolledBack).toBe(true);
    expect(finalized.finalErrorRate).toBe(0.12);
    expect(finalized.rollbackVerified).toBe(true);
    expect(rollbackWithVerification).toHaveBeenCalledTimes(1);
  });

  it("transitions PENDING -> FAILED when adapter throws during health check", async () => {
    let currentTime = 1000;
    const fakePrisma = createFakePrisma();
    const outcome: RolloutOutcomeRecord = {
      id: "outcome-3",
      commitSha: "sha789",
      status: "PENDING",
      threshold: 0.05,
      window: 20,
      startedAt: new Date(currentTime),
      rolledBack: false,
      createdAt: new Date(currentTime),
      updatedAt: new Date(currentTime),
    };
    fakePrisma.outcomes.set(outcome.id, outcome);

    const checkHealth = vi.fn().mockRejectedValue(new Error("connection timeout to pm2"));
    const adapter: RollbackAdapter = { checkHealth, rollback: vi.fn() };

    const monitor = new RolloutMonitor({
      prismaClient: fakePrisma,
      logger: fakeLogger,
      now: () => new Date(currentTime),
    });

    monitor.enqueue(outcome, adapter);
    await monitor.waitForJobs();

    const finalized = fakePrisma.outcomes.get("outcome-3")!;
    expect(finalized.status).toBe("FAILED");
    expect(finalized.reason).toContain("connection timeout to pm2");
  });

  it("recovers on boot: finalizes expired rows and resumes unexpired rows", async () => {
    const bootTime = 100000;
    const fakePrisma = createFakePrisma([
      {
        id: "outcome-expired",
        commitSha: "expired-sha",
        status: "PENDING",
        threshold: 0.05,
        window: 60,
        startedAt: new Date(bootTime - 100000), // started 100s ago, window 60s -> expired
        rolledBack: false,
        createdAt: new Date(bootTime - 100000),
        updatedAt: new Date(bootTime - 100000),
      },
      {
        id: "outcome-active",
        commitSha: "active-sha",
        status: "PENDING",
        threshold: 0.05,
        window: 60,
        startedAt: new Date(bootTime - 30000), // started 30s ago, window 60s -> 30s remaining
        rolledBack: false,
        createdAt: new Date(bootTime - 30000),
        updatedAt: new Date(bootTime - 30000),
      },
    ]);

    const checkHealth = vi.fn().mockResolvedValue({ errorRate: 0.0, healthy: true });
    const adapter: RollbackAdapter = { checkHealth, rollback: vi.fn() };

    let currentTime = bootTime;
    const sleep = vi.fn().mockImplementation(async (ms: number) => {
      currentTime += ms;
    });

    const monitor = new RolloutMonitor({
      prismaClient: fakePrisma,
      logger: fakeLogger,
      pollIntervalMs: 5000,
      sleep,
      now: () => new Date(currentTime),
      adapterFactory: () => adapter,
    });

    const recoveredCount = await monitor.recoverPending();
    expect(recoveredCount).toBe(2);

    const expired = fakePrisma.outcomes.get("outcome-expired")!;
    expect(expired.status).toBe("SUCCESS");

    // Wait for resumed active monitor to finish
    await monitor.waitForJobs();
    const active = fakePrisma.outcomes.get("outcome-active")!;
    expect(active.status).toBe("SUCCESS");
  });
});
