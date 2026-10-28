import type { ChangeVector } from "../classifier/vector.js";

/**
 * The five change categories the threshold decay formula operates over, including
 * `data` (migrations/schema). Deliberately excludes `code_complexity` — that field
 * is a separate multiplicative penalty applied after the per-type contributions are
 * combined, not one of the per-type contributions itself (see computeThreshold below).
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

import { DEFAULT_ENGINE_CONFIG, CURRENT_ENGINE_CONFIG, type VersionedEngineConfig } from "./versionedEngineConfig.js";

export { DEFAULT_ENGINE_CONFIG, CURRENT_ENGINE_CONFIG, type VersionedEngineConfig };

/**
 * Default tuning (v1). Windows widen from infra (fastest-moving, tightest blast radius) up
 * to code (broadest, most permissive): infra=60s, dependency=180s, config=300s,
 * data=600s (db migrations), code=900s (15 min). Thresholds follow the same ordering —
 * infra and data are the most sensitive (smallest threshold, easiest to trip), code the least.
 */
export const DEFAULT_CONFIG: ThresholdConfig = DEFAULT_ENGINE_CONFIG;


export interface ThresholdResult {
  finalThreshold: number;
  finalWindow: number;
  activeTypes: ChangeType[];
}

/**
 * Computes the effective anomaly threshold and evaluation window for a commit's
 * ChangeVector, per the threshold decay formula:
 *
 *   for each type in [infra, dependency, config, code, data] where vector[type] > 0:
 *     contribution[type]       = baseThreshold[type] * (1 - decay * vector[type])
 *     contributionWindow[type] = baseWindow[type]     * (1 - decay * vector[type])
 *   finalThreshold = min(contribution[type] for active types)
 *   finalWindow    = max(contributionWindow[type] for active types)  // #150
 *   if vector.code_complexity > 0:
 *     finalThreshold *= (1 - complexityDecay * vector.code_complexity)
 *
 * The strictest (minimum) threshold wins across active types, so a commit touching
 * multiple categories is held to whichever category is most sensitive. The observation
 * window uses the maximum so a short-window type (infra, 60s) cannot truncate soak for
 * a long-window type shipped in the same commit (data, 600s). See issue #150.
 *
 * Empty vectors have no policy: callers must skip classification results of null.
 * Direct empty or invalid inputs are rejected rather than returning non-JSON numbers.
 */
export function computeThreshold(vector: ChangeVector, config: ThresholdConfig = DEFAULT_CONFIG): ThresholdResult {
  for (const type of [...CHANGE_TYPES, "code_complexity"] as const) {
    if (!Number.isFinite(vector[type]) || vector[type] < 0 || vector[type] > 1) {
      throw new RangeError(`Change vector ${type} must be finite and within [0, 1]`);
    }
  }
  for (const value of [config.decay, config.complexityDecay]) {
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError("Decay must be within [0, 1]");
  }
  for (const type of CHANGE_TYPES) {
    for (const value of [config.baseThreshold[type], config.baseWindow[type]]) {
      if (!Number.isFinite(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER) {
        throw new RangeError(`Invalid threshold/window configuration for ${type}`);
      }
    }
  }
  const activeTypes = CHANGE_TYPES.filter((type) => vector[type] > 0);

  if (activeTypes.length === 0) {
    throw new RangeError("Empty change vector has no policy; skip threshold computation");
  }

  const thresholdContributions = activeTypes.map(
    (type) => config.baseThreshold[type] * (1 - config.decay * vector[type])
  );
  const windowContributions = activeTypes.map(
    (type) => config.baseWindow[type] * (1 - config.decay * vector[type])
  );

  let finalThreshold = Math.min(...thresholdContributions);
  const finalWindow = Math.max(...windowContributions);

  if (vector.code_complexity > 0) {
    finalThreshold *= 1 - config.complexityDecay * vector.code_complexity;
  }

  return { finalThreshold, finalWindow, activeTypes };
}
