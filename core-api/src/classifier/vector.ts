import { classifyTier1, type Tier1Result, type UserPatternRule } from "./tier1.js";
import { StubComplexityScorer, type CodeComplexityScorer, type CodeFile } from "./codeComplexityScorer.js";

export interface ChangeVector {
  infra: number;
  dependency: number;
  config: number;
  code: number;
  code_complexity: number;
}

// Configurable ceiling a raw Tier 2 complexity score is normalized against to produce
// code_complexity in [0, 1]. 50 is a starting point pending calibration against the
// Phase 3 evaluation harness (see docs/CARF_PROPOSED_IMPLEMENTATION.md §7).
export const MAX_COMPLEXITY_CEILING = 50;

/**
 * Builds the normalized ChangeVector from a Tier 1 result and a Tier 2 complexity score.
 *
 * Returns null — not a degenerate all-zero vector — when tier1.totalFiles is 0, i.e. the
 * commit touched only "unclassified" files (or nothing at all). Callers must treat null
 * as "skip threshold computation for this commit," per core-api/CLAUDE.md.
 */
export function buildChangeVector(tier1: Tier1Result, tier2ComplexityScore: number): ChangeVector | null {
  if (tier1.totalFiles === 0) {
    return null;
  }

  const { tally, totalFiles } = tier1;
  const clampedComplexity = Math.min(1, Math.max(0, tier2ComplexityScore / MAX_COMPLEXITY_CEILING));

  return {
    infra: tally.infra / totalFiles,
    dependency: tally.dependency / totalFiles,
    config: tally.config / totalFiles,
    code: tally.code / totalFiles,
    code_complexity: clampedComplexity,
  };
}

/**
 * Full pipeline entry point: runs Tier 1, routes "code" files to the injected
 * CodeComplexityScorer, and returns the final ChangeVector. This is the only function
 * routes/threshold code should call — never tier1.ts/tier2.ts directly.
 */
export function classifyCommit(
  changedFiles: CodeFile[],
  scorer: CodeComplexityScorer = new StubComplexityScorer(),
  userRules: UserPatternRule[] = []
): ChangeVector | null {
  const tier1 = classifyTier1(
    changedFiles.map((f) => f.path),
    userRules
  );
  const codeFiles = changedFiles.filter((f) =>
    tier1.files.some((classified) => classified.path === f.path && classified.type === "code")
  );
  const complexityScore = scorer.score(codeFiles);
  return buildChangeVector(tier1, complexityScore);
}
