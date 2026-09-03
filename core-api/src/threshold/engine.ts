import type { ChangeVector } from "../classifier/vector.js";

/**
 * The four change categories the threshold decay formula operates over. Deliberately
 * excludes `code_complexity` — that field is a separate multiplicative penalty applied
 * after the per-type contributions are combined, not one of the per-type contributions
 * itself (see computeThreshold below).
 */
export type ChangeType = "infra" | "dependency" | "config" | "code" | "data";

const CHANGE_TYPES: readonly ChangeType[] = ["infra", "dependency", "config", "code", "data"];

export interface ThresholdConfig {
  /** Baseline anomaly-score threshold per change type before decay is applied. */
  baseThreshold: Record<ChangeType, number>;
  /** Baseline rollback-evaluation window, in seconds, per change type before decay. */
  baseWindow: Record<ChangeType, number>;
  /** How aggressively a type's own vector magnitude decays its threshold/window. */
  decay: number;
  /** How aggressively code_complexity further decays the final threshold. */
  complexityDecay: number;
}

/**
 * Default tuning. Windows widen from infra (fastest-moving, tightest blast radius) up
 * to code (broadest, most permissive): infra=60s, dependency=180s, config=300s,
 * data=600s (db migrations), code=900s (15 min). Thresholds follow the same ordering —
 * infra and data are the most sensitive (smallest threshold, easiest to trip), code the least.
 */
export const DEFAULT_CONFIG: ThresholdConfig = {
  baseThreshold: {
    infra: 0.01,
    dependency: 0.03,
    config: 0.05,
    code: 0.08,
    data: 0.01,
  },
  baseWindow: {
    infra: 60,
    dependency: 180,
    config: 300,
    code: 900,
    data: 600,
  },
  decay: 0.5,
  complexityDecay: 0.3,
};

export interface ThresholdResult {
  finalThreshold: number;
  finalWindow: number;
  activeTypes: ChangeType[];
}

/**
 * Computes the effective anomaly threshold and evaluation window for a commit's
 * ChangeVector, per the threshold decay formula:
 *
 *   for each type in [infra, dependency, config, code] where vector[type] > 0:
 *     contribution[type]       = baseThreshold[type] * (1 - decay * vector[type])
 *     contributionWindow[type] = baseWindow[type]     * (1 - decay * vector[type])
 *   finalThreshold = min(contribution[type] for active types)
 *   finalWindow    = min(contributionWindow[type] for active types)
 *   if vector.code_complexity > 0:
 *     finalThreshold *= (1 - complexityDecay * vector.code_complexity)
 *
 * The strictest (minimum) contribution wins across active types, so a commit touching
 * multiple categories is held to whichever category is most sensitive.
 *
 * Safe default for an all-zero vector: with no active types there is nothing to take a
 * min() over, so rather than fabricate a numeric threshold we return
 * `{ finalThreshold: Infinity, finalWindow: Infinity, activeTypes: [] }`. Infinity reads
 * naturally at call sites — nothing can exceed it, so a signal-less commit can never by
 * itself trip a rollback, and callers don't need a special-cased branch to detect "no
 * signal" the way they already do for `classifyCommit()` returning `null`.
 */
export function computeThreshold(vector: ChangeVector, config: ThresholdConfig = DEFAULT_CONFIG): ThresholdResult {
  const activeTypes = CHANGE_TYPES.filter((type) => vector[type] > 0);

  if (activeTypes.length === 0) {
    return { finalThreshold: Infinity, finalWindow: Infinity, activeTypes: [] };
  }

  const thresholdContributions = activeTypes.map(
    (type) => config.baseThreshold[type] * (1 - config.decay * vector[type])
  );
  const windowContributions = activeTypes.map(
    (type) => config.baseWindow[type] * (1 - config.decay * vector[type])
  );

  let finalThreshold = Math.min(...thresholdContributions);
  const finalWindow = Math.min(...windowContributions);

  if (vector.code_complexity > 0) {
    finalThreshold *= 1 - config.complexityDecay * vector.code_complexity;
  }

  return { finalThreshold, finalWindow, activeTypes };
}
