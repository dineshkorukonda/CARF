import { describe, expect, it, vi } from "vitest";
import type { RollbackAdapter } from "../../src/adapters/rollbackAdapter.js";
import type { RolloutOutcomePrismaClient, RolloutOutcomeRecord } from "../../src/adapters/rolloutOutcome.js";
import { RolloutMonitor } from "../../src/monitor/rolloutMonitor.js";

function createFakePrisma(
  initialOutcomes: RolloutOutcomeRecord[] = [],
  changeVectors: Map<string, { data: number }> = new Map()
): RolloutOutcomePrismaClient & { outcomes: Map<string, RolloutOutcomeRecord> } {
  const outcomes = new Map<string, RolloutOutcomeRecord>();
  for (const outcome of initialOutcomes) {
    outcomes.set(outcome.id, { ...outcome });
  }

  return {
    outcomes,
    rolloutOutcome: {
      async findMany(args: any) {
        let list = Array.from(outcomes.values());
        if (args?.where?.status) {
          list = list.filter((o) => o.status === args.where!.status);
        }
        return list;
      },
      async upsert(args: any) {
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
      async update(args: any) {
        const existing = outcomes.get(args.where.id);
        if (!existing) {
          throw new Error(`Record ${args.where.id} not found`);
        }
        Object.assign(existing, args.data, { updatedAt: new Date() });
        return existing;
      },
    },
    changeVector: {
      findUnique: vi.fn(async ({ where }: { where: { commitId: string } }) => changeVectors.get(where.commitId) ?? null),
      findFirst: vi.fn(async ({ where }: { where: { commit?: { sha?: string } } }) =>
        where.commit?.sha ? changeVectors.get(where.commit.sha) ?? null : null
      ),
    },
    commit: {
      findFirst: vi.fn(async ({ where }: { where: { sha: string } }) => {
        const cv = changeVectors.get(where.sha);
        return cv ? { changeVector: cv } : null;
      }),
    },
  } as unknown as RolloutOutcomePrismaClient & { outcomes: Map<string, RolloutOutcomeRecord> };
}

describe("RolloutMonitor State Machine", () => {
  it("persists an Actions rollback decision without executing it, including after restart", async () => {
    const outcome: RolloutOutcomeRecord = {
      id: "actions", commitSha: "bad", previousSha: "healthy", rollbackExecutor: "github_actions",
      status: "PENDING", threshold: 0.05, window: 10, startedAt: new Date(0),
      rolledBack: false, createdAt: new Date(0), updatedAt: new Date(0),
    };
    const prisma = createFakePrisma([outcome]);
    const adapter = { checkHealth: vi.fn().mockResolvedValue({ errorRate: 1, healthy: false, processErrorRate: 1 }), rollback: vi.fn() };
    const monitor = new RolloutMonitor({ prismaClient: prisma, logger: { info: vi.fn(), error: vi.fn() }, now: () => new Date(1000) });
    await monitor.enqueue(outcome, adapter);
    const saved = prisma.outcomes.get("actions")!;
    expect(saved.status).toBe("PENDING");
    expect(saved.rollbackRequestedAt).toEqual(new Date(1000));
    expect(saved.rolledBack).toBe(false);
    expect(adapter.rollback).not.toHaveBeenCalled();
    await monitor.recoverPending(() => adapter);
    expect(adapter.checkHealth).toHaveBeenCalledTimes(1);
    expect(adapter.rollback).not.toHaveBeenCalled();
  });
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

  it("dispatches a rollback alert after a threshold breach without failing the rollback", async () => {
    let currentTime = 1000;
    const fakePrisma = createFakePrisma();
    const outcome: RolloutOutcomeRecord = {
      id: "outcome-alert",
      owner: "acme",
      repo: "widgets",
      commitSha: "sha-alert",
      status: "PENDING",
      threshold: 0.05,
      window: 30,
      startedAt: new Date(currentTime),
      rolledBack: false,
      createdAt: new Date(currentTime),
      updatedAt: new Date(currentTime),
    };
    fakePrisma.outcomes.set(outcome.id, outcome);

    const onRollbackAlert = vi.fn().mockRejectedValue(new Error("webhook down"));
    const adapter: RollbackAdapter = {
      checkHealth: vi.fn().mockResolvedValue({ errorRate: 0.2, healthy: false }),
      rollback: vi.fn(),
      rollbackWithVerification: vi.fn().mockResolvedValue({ rollbackVerified: true }),
    };

    const monitor = new RolloutMonitor({
      prismaClient: fakePrisma,
      logger: fakeLogger,
      pollIntervalMs: 2000,
      sleep: async (ms) => {
        currentTime += ms;
      },
      now: () => new Date(currentTime),
      onRollbackAlert,
    });

    monitor.enqueue(outcome, adapter);
    await monitor.waitForJobs();

    expect(fakePrisma.outcomes.get("outcome-alert")!.status).toBe("ROLLED_BACK");
    expect(onRollbackAlert).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "acme", repo: "widgets", commitSha: "sha-alert" })
    );
  });

  it("transitions PENDING -> FAILED when adapter throws during health check", async () => {
    const currentTime = 1000;
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
      adapterFactory: async () => adapter,
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

  it("ignores HTTP probe failure during startupGraceSeconds, records readyAt on first healthy poll, and starts window from readyAt", async () => {
    let currentTime = 1000;
    const fakePrisma = createFakePrisma();
    const outcome: RolloutOutcomeRecord = {
      id: "outcome-grace-1",
      commitSha: "sha-grace",
      status: "PENDING",
      threshold: 0.05,
      window: 10, // 10s soak window
      startedAt: new Date(currentTime),
      rolledBack: false,
      createdAt: new Date(currentTime),
      updatedAt: new Date(currentTime),
    };
    fakePrisma.outcomes.set(outcome.id, outcome);

    // First 2 polls: process healthy (processErrorRate 0), but HTTP probe failing (healthy: false)
    // 3rd poll: healthy: true
    // Subsequent polls: healthy: true
    const checkHealth = vi
      .fn()
      .mockResolvedValueOnce({ errorRate: 0.5, healthy: false, processErrorRate: 0, httpErrorRate: 1.0 })
      .mockResolvedValueOnce({ errorRate: 0.5, healthy: false, processErrorRate: 0, httpErrorRate: 1.0 })
      .mockResolvedValue({ errorRate: 0.0, healthy: true, processErrorRate: 0, httpErrorRate: 0 });

    const rollback = vi.fn();
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

    // Enqueue with 60s startup grace
    monitor.enqueue(outcome, adapter, "test-app", 60);
    await monitor.waitForJobs();

    const finalized = fakePrisma.outcomes.get("outcome-grace-1")!;
    expect(finalized.status).toBe("SUCCESS");
    expect(finalized.rolledBack).toBe(false);
    expect(finalized.readyAt).toBeDefined();
    // readyAt was recorded at poll 3 (after 2 sleep intervals of 2000ms: currentTime = 1000 + 4000 = 5000)
    expect(new Date(finalized.readyAt!).getTime()).toBe(5000);
    expect(rollback).not.toHaveBeenCalled();
  });

  it("initiates immediate rollback if process crashes or restarts during startupGraceSeconds", async () => {
    const currentTime = 1000;
    const fakePrisma = createFakePrisma();
    const outcome: RolloutOutcomeRecord = {
      id: "outcome-crash",
      commitSha: "sha-crash",
      status: "PENDING",
      threshold: 0.05,
      window: 30,
      startedAt: new Date(currentTime),
      rolledBack: false,
      createdAt: new Date(currentTime),
      updatedAt: new Date(currentTime),
    };
    fakePrisma.outcomes.set(outcome.id, outcome);

    // Target process crashes during grace (processErrorRate: 1.0)
    const checkHealth = vi.fn().mockResolvedValue({
      errorRate: 1.0,
      healthy: false,
      processErrorRate: 1.0,
      httpErrorRate: 1.0,
    });
    const rollbackWithVerification = vi.fn().mockResolvedValue({ rollbackVerified: true });
    const adapter: RollbackAdapter = { checkHealth, rollback: vi.fn(), rollbackWithVerification };

    const monitor = new RolloutMonitor({
      prismaClient: fakePrisma,
      logger: fakeLogger,
      pollIntervalMs: 2000,
      now: () => new Date(currentTime),
    });

    monitor.enqueue(outcome, adapter, "target-app", 60);
    await monitor.waitForJobs();

    const finalized = fakePrisma.outcomes.get("outcome-crash")!;
    expect(finalized.status).toBe("ROLLED_BACK");
    expect(finalized.rolledBack).toBe(true);
    expect(finalized.reason).toContain("Process failure during startup grace period");
    expect(rollbackWithVerification).toHaveBeenCalledTimes(1);
  });

  it("initiates rollback if startup grace period expires without reaching healthy state", async () => {
    let currentTime = 1000;
    const fakePrisma = createFakePrisma();
    const outcome: RolloutOutcomeRecord = {
      id: "outcome-grace-expired",
      commitSha: "sha-timeout",
      status: "PENDING",
      threshold: 0.05,
      window: 30,
      startedAt: new Date(currentTime),
      rolledBack: false,
      createdAt: new Date(currentTime),
      updatedAt: new Date(currentTime),
    };
    fakePrisma.outcomes.set(outcome.id, outcome);

    // Process is running, but HTTP probe never succeeds (processErrorRate 0, healthy: false)
    const checkHealth = vi.fn().mockResolvedValue({
      errorRate: 0.5,
      healthy: false,
      processErrorRate: 0,
      httpErrorRate: 1.0,
    });
    const rollback = vi.fn().mockResolvedValue(undefined);
    const adapter: RollbackAdapter = { checkHealth, rollback };

    const sleep = vi.fn().mockImplementation(async (ms: number) => {
      currentTime += ms;
    });

    const monitor = new RolloutMonitor({
      prismaClient: fakePrisma,
      logger: fakeLogger,
      pollIntervalMs: 5000,
      sleep,
      now: () => new Date(currentTime),
    });

    // Grace is 10 seconds. Polls at t=1000, t=6000, t=11000 (grace expired)
    monitor.enqueue(outcome, adapter, "target-app", 10);
    await monitor.waitForJobs();

    const finalized = fakePrisma.outcomes.get("outcome-grace-expired")!;
    expect(finalized.status).toBe("ROLLED_BACK");
    expect(finalized.rolledBack).toBe(true);
    expect(finalized.reason).toContain("Startup grace period (10s) expired without passing health check");
    expect(rollback).toHaveBeenCalledTimes(1);
  });

  it("appends '; schema not reverted' to rollback reason when changeVector has data > 0", async () => {
    let currentTime = 1000;
    const changeVectors = new Map<string, { data: number }>([
      ["sha-schema-change", { data: 2 }],
    ]);
    const fakePrisma = createFakePrisma([], changeVectors);
    const outcome: RolloutOutcomeRecord = {
      id: "outcome-schema",
      commitSha: "sha-schema-change",
      status: "PENDING",
      threshold: 0.05,
      window: 10,
      startedAt: new Date(currentTime),
      rolledBack: false,
      createdAt: new Date(currentTime),
      updatedAt: new Date(currentTime),
    };
    fakePrisma.outcomes.set(outcome.id, outcome);

    const checkHealth = vi
      .fn()
      .mockResolvedValueOnce({ errorRate: 0.0, healthy: true })
      .mockResolvedValueOnce({ errorRate: 0.2, healthy: false });
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

    monitor.enqueue(outcome, adapter, "target-app", 60);
    await monitor.waitForJobs();

    const finalized = fakePrisma.outcomes.get("outcome-schema")!;
    expect(finalized.status).toBe("ROLLED_BACK");
    expect(finalized.rolledBack).toBe(true);
    expect(finalized.reason).toContain("; schema not reverted");
  });
});
