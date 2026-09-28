import type { RollbackAdapter } from "../adapters/rollbackAdapter.js";
import {
  finalizeRolloutOutcome,
  getPendingRolloutOutcomes,
  recordRolloutSample,
  pruneRolloutSamples,
  type RolloutOutcomePrismaClient,
  type RolloutOutcomeRecord,
} from "../adapters/rolloutOutcome.js";

export interface MonitorLogger {
  info(details: Record<string, unknown>, message: string): void;
  error(details: Record<string, unknown>, message: string): void;
}

export interface RolloutMonitorOptions {
  prismaClient: RolloutOutcomePrismaClient;
  logger: MonitorLogger;
  /** Poll interval in milliseconds. Defaults to 2000ms. */
  pollIntervalMs?: number;
  /** Sleep function injected for testing. */
  sleep?: (ms: number) => Promise<void>;
  /** Clock provider for testing. */
  now?: () => Date;
  /** Factory to reconstruct adapters during crash recovery. */
  adapterFactory?: ((outcome: RolloutOutcomeRecord) => RollbackAdapter | undefined) | undefined;
}

function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RolloutMonitor {
  private readonly prisma: RolloutOutcomePrismaClient;
  private readonly logger: MonitorLogger;
  private readonly pollIntervalMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => Date;
  private readonly adapterFactory?: ((outcome: RolloutOutcomeRecord) => RollbackAdapter | undefined) | undefined;

  private runningJobs = new Map<string, Promise<void>>();
  private isStopped = false;

  constructor(options: RolloutMonitorOptions) {
    this.prisma = options.prismaClient;
    this.logger = options.logger;
    this.pollIntervalMs = options.pollIntervalMs ?? 2000;
    this.sleep = options.sleep ?? realSleep;
    this.now = options.now ?? (() => new Date());
    this.adapterFactory = options.adapterFactory;
  }

  /**
   * Enqueues and starts active monitoring for a given RolloutOutcome record.
   * Returns immediately after launching the background task.
   */
  enqueue(outcome: RolloutOutcomeRecord, adapter: RollbackAdapter, targetName?: string): void {
    if (this.isStopped) {
      this.logger.error({ id: outcome.id }, "monitor is stopped, cannot enqueue new job");
      return;
    }

    if (this.runningJobs.has(outcome.id)) {
      this.logger.info({ id: outcome.id, commitSha: outcome.commitSha }, "monitoring job already running for outcome");
      return;
    }

    const jobPromise = this.runMonitorLoop(outcome, adapter, targetName).finally(() => {
      this.runningJobs.delete(outcome.id);
    });

    this.runningJobs.set(outcome.id, jobPromise);
  }

  /**
   * Scans for any PENDING RolloutOutcome rows in the database upon startup.
   * Finalizes expired ones and resumes monitoring for still-active ones.
   */
  async recoverPending(adapterFactory?: (outcome: RolloutOutcomeRecord) => RollbackAdapter | undefined): Promise<number> {
    const factory = adapterFactory ?? this.adapterFactory;
    const pendingOutcomes = await getPendingRolloutOutcomes(this.prisma);
    const currentTime = this.now().getTime();
    let recoveredCount = 0;

    for (const outcome of pendingOutcomes) {
      const startTime = new Date(outcome.startedAt).getTime();
      const elapsedSeconds = Math.max(0, Math.floor((currentTime - startTime) / 1000));
      const remainingSeconds = outcome.window - elapsedSeconds;

      const adapter = factory ? factory(outcome) : undefined;

      if (!adapter) {
        if (remainingSeconds <= 0) {
          // Expired while offline without an adapter: finalize as SUCCESS
          await finalizeRolloutOutcome(this.prisma, {
            id: outcome.id,
            status: "SUCCESS",
            rolledBack: false,
            reason: "Window expired during server offline period",
            finishedAt: this.now(),
          });
          recoveredCount++;
        } else {
          this.logger.error(
            { id: outcome.id, commitSha: outcome.commitSha },
            "cannot resume pending rollout monitor: no adapter factory provided"
          );
        }
        continue;
      }

      if (remainingSeconds <= 0) {
        // Expired while offline: do a single health check to determine outcome
        try {
          const health = await adapter.checkHealth();
          if (health.errorRate >= outcome.threshold) {
            let rollbackVerified: boolean | undefined = undefined;
            if (typeof adapter.rollbackWithVerification === "function") {
              const res = await adapter.rollbackWithVerification();
              rollbackVerified = res.rollbackVerified;
            } else {
              await adapter.rollback();
            }
            await finalizeRolloutOutcome(this.prisma, {
              id: outcome.id,
              status: "ROLLED_BACK",
              finalErrorRate: health.errorRate,
              rolledBack: true,
              rollbackVerified,
              reason: `Breach detected on boot recovery: errorRate ${health.errorRate} >= ${outcome.threshold}`,
              finishedAt: this.now(),
            });
          } else {
            await finalizeRolloutOutcome(this.prisma, {
              id: outcome.id,
              status: "SUCCESS",
              finalErrorRate: health.errorRate,
              rolledBack: false,
              reason: "Window expired during offline period and health is normal",
              finishedAt: this.now(),
            });
          }
        } catch (error) {
          await finalizeRolloutOutcome(this.prisma, {
            id: outcome.id,
            status: "FAILED",
            rolledBack: false,
            reason: `Recovery health check threw error: ${(error as Error).message}`,
            finishedAt: this.now(),
          });
        }
      } else {
        // Still within window: resume active monitoring
        this.enqueue(outcome, adapter);
      }
      recoveredCount++;
    }

    return recoveredCount;
  }

  /**
   * Internal loop monitoring target health until window expires or breach occurs.
   */
  private async runMonitorLoop(
    outcome: RolloutOutcomeRecord,
    adapter: RollbackAdapter,
    targetName?: string
  ): Promise<void> {
    const startTime = new Date(outcome.startedAt).getTime();
    const windowMs = outcome.window * 1000;
    let lastErrorRate = 0;

    this.logger.info(
      { id: outcome.id, commitSha: outcome.commitSha, window: outcome.window, threshold: outcome.threshold },
      "started rollout health monitoring loop"
    );

    try {
      while (!this.isStopped) {
        const elapsedMs = this.now().getTime() - startTime;

        if (elapsedMs >= windowMs) {
          // Window closed without breach -> SUCCESS
          await finalizeRolloutOutcome(this.prisma, {
            id: outcome.id,
            status: "SUCCESS",
            finalErrorRate: lastErrorRate,
            rolledBack: false,
            reason: "Soak window completed without threshold breach",
            finishedAt: this.now(),
          });
          this.logger.info({ id: outcome.id, commitSha: outcome.commitSha }, "rollout completed successfully");
          return;
        }

        // Poll health
        const health = await adapter.checkHealth(targetName);
        lastErrorRate = health.errorRate;

        // Record telemetry sample on each poll
        try {
          await recordRolloutSample(
            this.prisma,
            outcome.id,
            health.errorRate,
            (health as { perTarget?: unknown }).perTarget,
            this.now()
          );
        } catch (sampleErr) {
          this.logger.error({ id: outcome.id, error: sampleErr }, "failed to record rollout sample");
        }

        if (health.errorRate >= outcome.threshold) {
          this.logger.error(
            { id: outcome.id, errorRate: health.errorRate, threshold: outcome.threshold },
            "error rate threshold breached, initiating rollback"
          );

          let rollbackVerified: boolean | undefined = undefined;
          if (typeof adapter.rollbackWithVerification === "function") {
            const verifyResult = await adapter.rollbackWithVerification(targetName);
            rollbackVerified = verifyResult.rollbackVerified;
          } else {
            await adapter.rollback(targetName);
          }

          await finalizeRolloutOutcome(this.prisma, {
            id: outcome.id,
            status: "ROLLED_BACK",
            finalErrorRate: lastErrorRate,
            rolledBack: true,
            rollbackVerified,
            reason: `Error rate ${lastErrorRate} breached threshold ${outcome.threshold}`,
            finishedAt: this.now(),
          });
          return;
        }

        const remainingMs = windowMs - (this.now().getTime() - startTime);
        if (remainingMs > 0) {
          const sleepDuration = Math.min(this.pollIntervalMs, remainingMs);
          await this.sleep(sleepDuration);
        }
      }
    } catch (error) {
      this.logger.error(
        { id: outcome.id, error: (error as Error).message },
        "adapter threw during rollout monitoring; marking FAILED"
      );
      try {
        await finalizeRolloutOutcome(this.prisma, {
          id: outcome.id,
          status: "FAILED",
          finalErrorRate: lastErrorRate,
          rolledBack: false,
          reason: (error as Error).message,
          finishedAt: this.now(),
        });
      } catch (dbError) {
        this.logger.error({ id: outcome.id, error: dbError }, "failed to finalize outcome as FAILED in database");
      }
    }
  }

  async pruneOldSamples(retentionDays: number = 30): Promise<number> {
    return await pruneRolloutSamples(this.prisma, retentionDays);
  }

  async waitForJobs(): Promise<void> {
    await Promise.all(Array.from(this.runningJobs.values()));
  }

  async stop(): Promise<void> {
    this.isStopped = true;
    await Promise.all(Array.from(this.runningJobs.values()));
  }

  getActiveJobCount(): number {
    return this.runningJobs.size;
  }
}
