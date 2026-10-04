import type { RollbackAdapter } from "../adapters/rollbackAdapter.js";
import {
  finalizeRolloutOutcome,
  getPendingRolloutOutcomes,
  recordRolloutSample,
  pruneRolloutSamples,
  markRolloutReady,
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
  adapterFactory?: ((outcome: RolloutOutcomeRecord) => RollbackAdapter | undefined | Promise<RollbackAdapter | undefined>) | undefined;
  /** Optional rollback alert hook (Slack/email webhook). Failures must not block rollback. */
  onRollbackAlert?: ((event: {
    owner?: string | null | undefined;
    repo?: string | null | undefined;
    commitSha: string;
    reason: string;
    finalErrorRate?: number | null | undefined;
    rollbackVerified?: boolean | null | undefined;
  }) => Promise<void>) | undefined;
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
  private readonly adapterFactory?: RolloutMonitorOptions["adapterFactory"];
  private readonly onRollbackAlert?: RolloutMonitorOptions["onRollbackAlert"];

  private runningJobs = new Map<string, Promise<void>>();
  private isStopped = false;

  constructor(options: RolloutMonitorOptions) {
    this.prisma = options.prismaClient;
    this.logger = options.logger;
    this.pollIntervalMs = options.pollIntervalMs ?? 2000;
    this.sleep = options.sleep ?? realSleep;
    this.now = options.now ?? (() => new Date());
    this.adapterFactory = options.adapterFactory;
    this.onRollbackAlert = options.onRollbackAlert;
  }

  /**
   * Enqueues and starts active monitoring for a given RolloutOutcome record.
   * Returns immediately after launching the background task.
   */
  enqueue(
    outcome: RolloutOutcomeRecord,
    adapter: RollbackAdapter,
    targetName?: string,
    startupGraceSeconds: number = 60
  ): Promise<void> | undefined {
    if (this.isStopped) {
      this.logger.error({ id: outcome.id }, "monitor is stopped, cannot enqueue new job");
      return undefined;
    }

    if (this.runningJobs.has(outcome.id)) {
      this.logger.info({ id: outcome.id, commitSha: outcome.commitSha }, "monitoring job already running for outcome");
      return this.runningJobs.get(outcome.id);
    }

    const jobPromise = this.runMonitorLoop(outcome, adapter, targetName, startupGraceSeconds).finally(() => {
      this.runningJobs.delete(outcome.id);
    });

    this.runningJobs.set(outcome.id, jobPromise);
    return jobPromise;
  }

  /**
   * Scans for any PENDING RolloutOutcome rows in the database upon startup.
   * Finalizes expired ones and resumes monitoring for still-active ones.
   */
  async recoverPending(adapterFactory?: (outcome: RolloutOutcomeRecord) => RollbackAdapter | undefined | Promise<RollbackAdapter | undefined>): Promise<number> {
    const factory = adapterFactory ?? this.adapterFactory;
    const pendingOutcomes = await getPendingRolloutOutcomes(this.prisma);
    const currentTime = this.now().getTime();
    let recoveredCount = 0;

    for (const outcome of pendingOutcomes) {
      const startTime = outcome.readyAt ? new Date(outcome.readyAt).getTime() : new Date(outcome.startedAt).getTime();
      const elapsedSeconds = Math.max(0, Math.floor((currentTime - startTime) / 1000));
      const remainingSeconds = outcome.window - elapsedSeconds;

      const adapter = factory ? await factory(outcome) : undefined;

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
              const res = await adapter.rollbackWithVerification(undefined, 60);
              rollbackVerified = res.rollbackVerified;
            } else {
              await adapter.rollback();
            }

            let reason = `Breach detected on boot recovery: errorRate ${health.errorRate} >= ${outcome.threshold}`;
            if (await this.hasDataSchemaChange(outcome)) {
              reason = `${reason}; schema not reverted`;
            }

            await finalizeRolloutOutcome(this.prisma, {
              id: outcome.id,
              status: "ROLLED_BACK",
              finalErrorRate: health.errorRate,
              rolledBack: true,
              rollbackVerified,
              reason,
              finishedAt: this.now(),
            });
            await this.notifyRollbackAlert(outcome, reason, health.errorRate, rollbackVerified);
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
   * Enforces readiness gating:
   * - During startupGraceSeconds, ignores HTTP probe failures only.
   * - Process exits and restart deltas during grace trigger immediate rollback.
   * - readyAt is set upon the first healthy poll (process online and HTTP 2xx).
   * - Observation window starts at readyAt.
   * - If grace expires without a healthy poll, initiates rollback.
   * - Maximum total time in PENDING is startupGraceSeconds + window.
   */
  private async runMonitorLoop(
    outcome: RolloutOutcomeRecord,
    adapter: RollbackAdapter,
    targetName?: string,
    startupGraceSeconds: number = 60
  ): Promise<void> {
    const deployStartTime = this.now().getTime();
    const graceMs = startupGraceSeconds * 1000;
    const windowMs = outcome.window * 1000;
    const maxPendingMs = graceMs + windowMs;

    let readyAt = outcome.readyAt ? new Date(outcome.readyAt) : null;
    let observationStartTime = readyAt ? readyAt.getTime() : null;
    let lastErrorRate = 0;

    this.logger.info(
      {
        id: outcome.id,
        commitSha: outcome.commitSha,
        window: outcome.window,
        threshold: outcome.threshold,
        startupGraceSeconds,
        hasReadyAt: Boolean(readyAt),
      },
      "started rollout health monitoring loop"
    );

    try {
      while (!this.isStopped) {
        const nowMs = this.now().getTime();

        // Check maximum timeout in PENDING: startupGraceSeconds + window
        if (nowMs - deployStartTime >= maxPendingMs) {
          if (readyAt) {
            await this.finalizeSuccess(outcome, lastErrorRate, "Observation window completed");
          } else {
            await this.handleRollback(
              outcome,
              adapter,
              targetName,
              lastErrorRate,
              `Startup grace period (${startupGraceSeconds}s) expired without reaching healthy state`,
              startupGraceSeconds
            );
          }
          return;
        }

        // Poll target health
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

        const processErrorRate = health.processErrorRate ?? (health.healthy ? 0 : health.errorRate);

        // 1. Readiness Phase
        if (!readyAt) {
          // Process crash or restart delta during grace period is a breach!
          if (processErrorRate > 0) {
            this.logger.error(
              { id: outcome.id, processErrorRate, threshold: outcome.threshold },
              "process failure during startup grace period, initiating rollback"
            );
            await this.handleRollback(
              outcome,
              adapter,
              targetName,
              lastErrorRate,
              `Process failure during startup grace period (processErrorRate: ${processErrorRate})`,
              startupGraceSeconds
            );
            return;
          }

          // Check if first healthy poll occurred (process healthy AND HTTP 2xx)
          if (health.healthy) {
            readyAt = this.now();
            observationStartTime = readyAt.getTime();
            outcome.readyAt = readyAt;
            try {
              await markRolloutReady(this.prisma, outcome.id, readyAt);
            } catch (err) {
              this.logger.error({ id: outcome.id, error: err }, "failed to persist readyAt in database");
            }
            this.logger.info({ id: outcome.id, readyAt }, "target reached readiness; observation window started");
          } else {
            // HTTP probe failed during grace: ignore failure until grace expires
            const elapsedGraceMs = nowMs - deployStartTime;
            if (elapsedGraceMs >= graceMs) {
              this.logger.error(
                { id: outcome.id, elapsedGraceMs, graceMs },
                "startup grace period expired without reaching healthy state, initiating rollback"
              );
              await this.handleRollback(
                outcome,
                adapter,
                targetName,
                lastErrorRate,
                `Startup grace period (${startupGraceSeconds}s) expired without passing health check`,
                startupGraceSeconds
              );
              return;
            }
          }
        } else {
          // 2. Active Observation Phase (readyAt established)
          const elapsedObsMs = nowMs - (observationStartTime ?? deployStartTime);

          if (elapsedObsMs >= windowMs) {
            await this.finalizeSuccess(
              outcome,
              lastErrorRate,
              "Soak window completed without threshold breach"
            );
            return;
          }

          if (health.errorRate >= outcome.threshold) {
            this.logger.error(
              { id: outcome.id, errorRate: health.errorRate, threshold: outcome.threshold },
              "error rate threshold breached, initiating rollback"
            );
            await this.handleRollback(
              outcome,
              adapter,
              targetName,
              lastErrorRate,
              `Error rate ${lastErrorRate} breached threshold ${outcome.threshold}`,
              startupGraceSeconds
            );
            return;
          }
        }

        const elapsedObsMs = readyAt ? nowMs - (observationStartTime ?? deployStartTime) : 0;
        const remainingObsMs = readyAt ? windowMs - elapsedObsMs : windowMs;
        const sleepDuration = Math.min(this.pollIntervalMs, Math.max(100, remainingObsMs));
        await this.sleep(sleepDuration);
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

  private async finalizeSuccess(
    outcome: RolloutOutcomeRecord,
    lastErrorRate: number,
    reason: string
  ): Promise<void> {
    await finalizeRolloutOutcome(this.prisma, {
      id: outcome.id,
      status: "SUCCESS",
      finalErrorRate: lastErrorRate,
      rolledBack: false,
      reason,
      finishedAt: this.now(),
      readyAt: outcome.readyAt ?? undefined,
    });
    this.logger.info({ id: outcome.id, commitSha: outcome.commitSha }, "rollout completed successfully");
  }

  private async handleRollback(
    outcome: RolloutOutcomeRecord,
    adapter: RollbackAdapter,
    targetName: string | undefined,
    lastErrorRate: number,
    baseReason: string,
    startupGraceSeconds?: number
  ): Promise<void> {
    let rollbackVerified: boolean | undefined = undefined;
    if (typeof adapter.rollbackWithVerification === "function") {
      const verifyResult = await adapter.rollbackWithVerification(targetName, startupGraceSeconds);
      rollbackVerified = verifyResult.rollbackVerified;
    } else {
      await adapter.rollback(targetName);
    }

    let reason = baseReason;
    const hasSchemaChange = await this.hasDataSchemaChange(outcome);
    if (hasSchemaChange) {
      reason = `${baseReason}; schema not reverted`;
    }

    await finalizeRolloutOutcome(this.prisma, {
      id: outcome.id,
      status: "ROLLED_BACK",
      finalErrorRate: lastErrorRate,
      rolledBack: true,
      rollbackVerified,
      reason,
      finishedAt: this.now(),
      readyAt: outcome.readyAt ?? undefined,
    });

    await this.notifyRollbackAlert(outcome, reason, lastErrorRate, rollbackVerified);
  }

  private async notifyRollbackAlert(
    outcome: RolloutOutcomeRecord,
    reason: string,
    finalErrorRate?: number | null,
    rollbackVerified?: boolean | null
  ): Promise<void> {
    if (!this.onRollbackAlert) {
      return;
    }
    try {
      await this.onRollbackAlert({
        owner: outcome.owner,
        repo: outcome.repo,
        commitSha: outcome.commitSha,
        reason,
        finalErrorRate,
        rollbackVerified,
      });
    } catch (error) {
      this.logger.error({ error, id: outcome.id }, "rollback alert dispatch failed");
    }
  }

  private async hasDataSchemaChange(outcome: RolloutOutcomeRecord): Promise<boolean> {
    try {
      const client = this.prisma as unknown as {
        commit?: {
          findFirst?: (args: {
            where: { sha: string };
            include?: { changeVector: boolean };
          }) => Promise<{ changeVector?: { data?: number } | null } | null>;
        };
        changeVector?: {
          findFirst?: (args: {
            where: {
              commit?: { sha?: string };
              commitId?: string;
            };
          }) => Promise<{ data?: number } | null>;
          findUnique?: (args: { where: { commitId: string } }) => Promise<{ data?: number } | null>;
        };
      };

      if (outcome.commitId && client.changeVector?.findUnique) {
        const cv = await client.changeVector.findUnique({ where: { commitId: outcome.commitId } });
        if (cv && typeof cv.data === "number" && cv.data > 0) return true;
      }
      if (client.commit?.findFirst) {
        const commit = await client.commit.findFirst({
          where: { sha: outcome.commitSha },
          include: { changeVector: true },
        });
        if (commit?.changeVector && typeof commit.changeVector.data === "number" && commit.changeVector.data > 0) {
          return true;
        }
      }
      if (client.changeVector?.findFirst) {
        const cv = await client.changeVector.findFirst({
          where: { commit: { sha: outcome.commitSha } },
        });
        if (cv && typeof cv.data === "number" && cv.data > 0) return true;
      }
    } catch (err) {
      this.logger.error({ id: outcome.id, error: err }, "failed to check changeVector data for schema change");
    }
    return false;
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
