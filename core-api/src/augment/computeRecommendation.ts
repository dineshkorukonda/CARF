import type { CodeFile } from "../classifier/codeComplexityScorer.js";
import type { UserPatternRule } from "../classifier/tier1.js";
import { classifyCommit, type ChangeVector } from "../classifier/vector.js";
import { computeThreshold, DEFAULT_CONFIG, type ThresholdConfig } from "../threshold/engine.js";

export interface AugmentThresholdResponse {
  threshold: number;
  window: number;
  changeVector: ChangeVector;
}

/**
 * Read-only augment-mode recommendation: same classifier + threshold engine as
 * standalone `processCommit()`, with no rollback execution.
 */
export function computeAugmentRecommendation(
  changedFiles: CodeFile[],
  userRules: UserPatternRule[] = [],
  config: ThresholdConfig = DEFAULT_CONFIG
): AugmentThresholdResponse | null {
  const changeVector = classifyCommit(changedFiles, undefined, userRules);
  if (changeVector === null) {
    return null;
  }
  const result = computeThreshold(changeVector, config);
  return {
    threshold: result.finalThreshold,
    window: result.finalWindow,
    changeVector,
  };
}
