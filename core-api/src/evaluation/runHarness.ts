import type { SyntheticDeployment } from "./injector.js";
import { classifyCommit } from "../classifier/vector.js";
import type { UserPatternRule } from "../classifier/tier1.js";
import { computeThreshold, DEFAULT_CONFIG, type ThresholdConfig, type ThresholdResult } from "../threshold/engine.js";
import { runStandaloneLoop } from "../adapters/loop.js";
import type { RollbackAdapter } from "../adapters/rollbackAdapter.js";
import { prisma as defaultPrisma } from "../db/client.js";

export interface EvalMetrics {
  /** Rolled back but should_fail == false, as a fraction of all should_fail == false deployments. */
  falsePositiveRate: number;
  /** Average time-to-rollback (ms), over deployments where should_fail == true and a rollback fired. */
  truePositiveMttrMs: number;
  precision: number;
  recall: number;
}

/**
 * Condition A: a single fixed error-rate threshold/window applied to every deployment
 * regardless of change type — mirroring how Argo Rollouts/Flagger canary analyses are
 * typically configured out of the box (see examples/): one successCondition and one
 * canary duration for the whole rollout, not calibrated per change category. 1% error
 * rate is a common tight canary default (e.g. a `request-success-rate >= 99` check); 300s
 * matches a typical multi-step canary analysis duration — the same order of magnitude as
 * DEFAULT_CONFIG's own baseWindow values (src/threshold/engine.ts).
 */
export const STATIC_THRESHOLD: ThresholdResult = {
  finalThreshold: 0.01,
  finalWindow: 300,
  activeTypes: [],
};

const POLL_INTERVAL_MS = 5_000;
const RISKY_RAMP_MS = 600_000;
const RISKY_BASELINE = 0.01;
const RISKY_PEAK = 0.2;
const SAFE_BASELINE_FLOOR = 0.002;
const SAFE_BASELINE_CEIL = 0.008;
const SAFE_SPIKE_FLOOR = 0.012;
const SAFE_SPIKE_CEIL = 0.022;
const SAFE_SPIKE_PROBABILITY = 0.01;
const SAFE_NOISE_SAMPLE_COUNT = 64;

// Deterministic PRNG (mulberry32) seeded from the deployment id, so a run of the harness
// is fully reproducible — no reliance on Math.random, whose output would make FPR/MTTR
// (and therefore the Condition A vs. B comparison) flaky across runs.
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Builds the "true" simulated production error-rate as a function of elapsed time,
 * independent of which condition (A or B) is observing it — both conditions watch the
 * same underlying deployment behavior, just for different durations and against
 * different thresholds. `shouldFail` deployments ramp from a low baseline up to a real
 * degradation peak; safe deployments hold near a flat noise floor.
 */
function buildErrorRateSeries(deployment: SyntheticDeployment): (elapsedMs: number) => number {
  const rand = mulberry32(hashSeed(deployment.id));

  if (deployment.shouldFail) {
    const jitter = rand() * 0.02 - 0.01;
    return (elapsedMs: number) => {
      const t = Math.min(1, elapsedMs / RISKY_RAMP_MS);
      return Math.max(0, RISKY_BASELINE + t * (RISKY_PEAK - RISKY_BASELINE) + jitter);
    };
  }

  // Mostly a low, harmless noise floor (well under every dynamic threshold), with a rare
  // spike that a too-tight static threshold (e.g. STATIC_THRESHOLD's 1%) can still trip —
  // this is what produces Condition A's false positives on genuinely safe deployments.
  const samples: number[] = [];
  for (let i = 0; i < SAFE_NOISE_SAMPLE_COUNT; i++) {
    const isSpike = rand() < SAFE_SPIKE_PROBABILITY;
    samples.push(
      isSpike
        ? SAFE_SPIKE_FLOOR + rand() * (SAFE_SPIKE_CEIL - SAFE_SPIKE_FLOOR)
        : SAFE_BASELINE_FLOOR + rand() * (SAFE_BASELINE_CEIL - SAFE_BASELINE_FLOOR)
    );
  }
  return (elapsedMs: number) =>
    samples[Math.floor(elapsedMs / POLL_INTERVAL_MS) % samples.length] ?? SAFE_BASELINE_FLOOR;
}

/**
 * Drives the deployment's simulated error-rate series through the real Phase 3
 * standalone rollback loop (src/adapters/loop.ts), with a virtual clock in place of
 * wall-clock sleep so the simulation runs instantly regardless of `threshold.finalWindow`.
 */
async function simulateCondition(
  deployment: SyntheticDeployment,
  threshold: ThresholdResult,
  series: (elapsedMs: number) => number
): Promise<{ rolledBack: boolean; mttrMs: number | null }> {
  let elapsed = 0;
  let mttrMs: number | null = null;

  const adapter: RollbackAdapter = {
    checkHealth: async () => ({ errorRate: series(elapsed), healthy: true }),
    rollback: async () => {
      mttrMs = elapsed;
    },
  };

  const { rolledBack } = await runStandaloneLoop(deployment.id, adapter, threshold, deployment.id, {
    pollIntervalMs: POLL_INTERVAL_MS,
    sleep: async (ms: number) => {
      elapsed += ms;
    },
  });

  return { rolledBack, mttrMs };
}

type Outcome = "true_positive" | "false_positive" | "true_negative" | "false_negative";

function classifyOutcome(shouldFail: boolean, rolledBack: boolean): Outcome {
  if (shouldFail) return rolledBack ? "true_positive" : "false_negative";
  return rolledBack ? "false_positive" : "true_negative";
}

interface ConditionTally {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  tpMttrMsSum: number;
}

function zeroTally(): ConditionTally {
  return { tp: 0, fp: 0, tn: 0, fn: 0, tpMttrMsSum: 0 };
}

function toMetrics(tally: ConditionTally): EvalMetrics {
  const { tp, fp, tn, fn, tpMttrMsSum } = tally;
  return {
    falsePositiveRate: fp + tn === 0 ? 0 : fp / (fp + tn),
    truePositiveMttrMs: tp === 0 ? 0 : tpMttrMsSum / tp,
    precision: tp + fp === 0 ? 0 : tp / (tp + fp),
    recall: tp + fn === 0 ? 0 : tp / (tp + fn),
  };
}

/**
 * Minimal seam over the subset of PrismaClient's API `runEvaluation()` needs. Mirrors the
 * PipelinePrismaClient/ThresholdRoutePrismaClient convention (src/pipeline.ts,
 * src/routes/threshold.ts): real PrismaClient satisfies this structurally, tests inject
 * an in-memory fake so the harness can be exercised without a live Postgres.
 */
export interface EvaluationPrismaClient {
  evaluationLog: {
    create(args: {
      data: { commitSha: string; condition: string; outcome: string; mttrMs?: number | null };
    }): Promise<unknown>;
  };
}

export interface RunEvaluationOptions {
  /** Injected Prisma client seam; defaults to the app-wide singleton (src/db/client.ts). */
  prismaClient?: EvaluationPrismaClient;
  /** Threshold engine tuning for Condition B; defaults to DEFAULT_CONFIG. */
  thresholdConfig?: ThresholdConfig;
  /** User classification rules (from .carf.yml), checked before Tier 1's hardcoded rules. Defaults to none. */
  classificationRules?: UserPatternRule[];
}

/**
 * Runs the synthetic dataset through two conditions and returns aggregate metrics for
 * each:
 *   Condition A — a single static threshold/window (STATIC_THRESHOLD above), the same
 *     for every deployment, approximating an out-of-the-box Argo/Flagger canary config.
 *   Condition B — CARF's dynamic threshold (src/threshold/engine.ts's computeThreshold(),
 *     via the real classifyCommit() pipeline), calibrated per deployment from its
 *     ChangeVector.
 *
 * Both conditions observe the same underlying simulated error-rate series per deployment
 * (see buildErrorRateSeries) and decide rollback via the same real standalone rollback
 * loop (runStandaloneLoop), differing only in the threshold/window fed into it — so any
 * difference in outcomes traces to the threshold source, not the decision mechanism.
 *
 * Every deployment's outcome is logged to EvaluationLog for both conditions.
 */
export async function runEvaluation(
  deployments: SyntheticDeployment[],
  options: RunEvaluationOptions = {}
): Promise<{ conditionA: EvalMetrics; conditionB: EvalMetrics }> {
  const prismaClient = options.prismaClient ?? (defaultPrisma as unknown as EvaluationPrismaClient);
  const thresholdConfig = options.thresholdConfig ?? DEFAULT_CONFIG;

  const tallyA = zeroTally();
  const tallyB = zeroTally();

  for (const deployment of deployments) {
    const series = buildErrorRateSeries(deployment);

    const vector = classifyCommit(deployment.changedFiles, undefined, options.classificationRules ?? []);
    if (vector === null) {
      // The synthetic categories generateSyntheticDeployments() produces always carry
      // classifiable files (see injector.ts) — a null vector here means the dataset
      // itself is malformed, not a normal "no signal" case to skip past.
      throw new Error(`runEvaluation: classifyCommit returned null for synthetic deployment ${deployment.id}`);
    }
    const dynamicThreshold = computeThreshold(vector, thresholdConfig);

    const [resultA, resultB] = await Promise.all([
      simulateCondition(deployment, STATIC_THRESHOLD, series),
      simulateCondition(deployment, dynamicThreshold, series),
    ]);

    const outcomeA = classifyOutcome(deployment.shouldFail, resultA.rolledBack);
    const outcomeB = classifyOutcome(deployment.shouldFail, resultB.rolledBack);

    await Promise.all([
      prismaClient.evaluationLog.create({
        data: { commitSha: deployment.id, condition: "static", outcome: outcomeA, mttrMs: resultA.mttrMs },
      }),
      prismaClient.evaluationLog.create({
        data: { commitSha: deployment.id, condition: "carf_dynamic", outcome: outcomeB, mttrMs: resultB.mttrMs },
      }),
    ]);

    if (outcomeA === "true_positive") {
      tallyA.tp += 1;
      tallyA.tpMttrMsSum += resultA.mttrMs ?? 0;
    } else if (outcomeA === "false_positive") tallyA.fp += 1;
    else if (outcomeA === "true_negative") tallyA.tn += 1;
    else tallyA.fn += 1;

    if (outcomeB === "true_positive") {
      tallyB.tp += 1;
      tallyB.tpMttrMsSum += resultB.mttrMs ?? 0;
    } else if (outcomeB === "false_positive") tallyB.fp += 1;
    else if (outcomeB === "true_negative") tallyB.tn += 1;
    else tallyB.fn += 1;
  }

  return { conditionA: toMetrics(tallyA), conditionB: toMetrics(tallyB) };
}
