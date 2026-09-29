/**
 * Dashboard-side walkthrough of threshold math. Mirrors
 * core-api/src/threshold/versionedEngineConfig.ts v1 defaults — not imported.
 */
export const DEFAULT_THRESHOLD_EXPLAIN = {
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
  /** Same ceiling as core-api/src/classifier/vector.ts MAX_COMPLEXITY_CEILING. */
  complexityCeiling: 50,
} as const;

export type VectorMixKey = "infra" | "dependency" | "config" | "code" | "data";

export interface ExplainVector {
  infra: number;
  dependency: number;
  config: number;
  code: number;
  data: number;
  codeComplexity: number;
}

export interface MixWhy {
  key: VectorMixKey;
  share: number;
  why: string;
}

const MIX_WHY: Record<VectorMixKey, string> = {
  infra: "Share of classified files that look like deploy/runtime (Dockerfile, compose, Terraform, k8s/helm).",
  dependency: "Share of classified files that are lockfiles or manifests (package.json, go.mod, Cargo.toml, …).",
  config: "Share of classified files that are config (.carf.yml, yaml/toml/env, *.config.ts). CI workflow YAML often lands here.",
  code: "Share of classified files that are application source or tests. Tests are folded into code, not a sixth mix bar.",
  data: "Share of classified files that are SQL or migration paths.",
};

export function explainMix(vector: ExplainVector): MixWhy[] {
  return (Object.keys(MIX_WHY) as VectorMixKey[]).map((key) => ({
    key,
    share: vector[key],
    why:
      vector[key] <= 0
        ? `0% — classifier 1 did not type any file as ${key} in the persisted vector.`
        : `${(vector[key] * 100).toFixed(0)}% of classified files (the set that produced a vector) were typed ${key}. ${MIX_WHY[key]}`,
  }));
}

export function explainComplexity(codeComplexity: number): {
  scoreOutOf100: number;
  why: string;
  steps: string[];
} {
  const scoreOutOf100 = codeComplexity * 100;
  const atCeiling = codeComplexity >= 0.999;
  return {
    scoreOutOf100,
    why: atCeiling
      ? "This commit is at the complexity ceiling. Classifier 2 scored code/test files (tree-sitter AST diff, or the line-delta stub if AST is off). That raw score is divided by 50 and capped at 1.0, so 100/100 means the raw score was at least 50 — a large structural or line change, not a 100% mix of code."
      : `Classifier 2 only looks at files classifier 1 typed as code or test. The raw AST/line score is divided by 50 (the engine ceiling) and clamped to 0–1, then shown as 0–100. ${(scoreOutOf100).toFixed(1)}/100 means the raw score was about ${(codeComplexity * DEFAULT_THRESHOLD_EXPLAIN.complexityCeiling).toFixed(0)} before the cap.`,
    steps: [
      "Classifier 1 picks which paths are code or test.",
      "Classifier 2 diffs those files (functions changed, signatures, nesting, cyclomatic delta — or a line-delta stand-in).",
      `Normalize: stored codeComplexity = min(1, raw / ${DEFAULT_THRESHOLD_EXPLAIN.complexityCeiling}).`,
      `This number is not a sixth mix bar. It only tightens the error-rate ceiling by multiplying it by (1 − ${DEFAULT_THRESHOLD_EXPLAIN.complexityDecay} × complexity). It does not change the soak window.`,
    ],
  };
}

export interface TypeContribution {
  type: VectorMixKey;
  mix: number;
  baseThresholdPct: number;
  contribution: number;
  baseWindow: number;
  windowContribution: number;
}

export interface ThresholdWalkthrough {
  activeTypes: VectorMixKey[];
  contributions: TypeContribution[];
  strictestType: VectorMixKey | null;
  minBeforeComplexity: number;
  complexityFactor: number;
  reconstructedThreshold: number;
  reconstructedWindow: number;
  ceilingWhy: string;
  windowWhy: string;
  activeWhy: string;
  storedMatchesDefaultWalk: boolean;
}

export function explainThreshold(
  vector: ExplainVector,
  stored: { finalThreshold: number; finalWindow: number; activeTypes: string[] },
): ThresholdWalkthrough {
  const cfg = DEFAULT_THRESHOLD_EXPLAIN;
  const keys: VectorMixKey[] = ["infra", "dependency", "config", "code", "data"];
  const activeTypes = keys.filter((type) => vector[type] > 0);
  const contributions: TypeContribution[] = activeTypes.map((type) => {
    const mix = vector[type];
    const factor = 1 - cfg.decay * mix;
    return {
      type,
      mix,
      baseThresholdPct: cfg.baseThreshold[type] * 100,
      contribution: cfg.baseThreshold[type] * factor,
      baseWindow: cfg.baseWindow[type],
      windowContribution: cfg.baseWindow[type] * factor,
    };
  });

  const minBeforeComplexity =
    contributions.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...contributions.map((c) => c.contribution));
  const strictestType =
    contributions.find((c) => c.contribution === minBeforeComplexity)?.type ?? null;
  const complexityFactor =
    vector.codeComplexity > 0 ? 1 - cfg.complexityDecay * vector.codeComplexity : 1;
  const reconstructedThreshold = minBeforeComplexity * complexityFactor;
  const reconstructedWindow =
    contributions.length === 0
      ? Number.POSITIVE_INFINITY
      : Math.min(...contributions.map((c) => c.windowContribution));

  const storedMatchesDefaultWalk =
    Number.isFinite(stored.finalThreshold) &&
    Math.abs(stored.finalThreshold - reconstructedThreshold) < 0.0008 &&
    Math.abs(stored.finalWindow - Math.round(reconstructedWindow)) <= 1;

  const parts = contributions.map(
    (c) =>
      `${c.type}: default ${c.baseThresholdPct.toFixed(0)}% × (1 − ${cfg.decay} × ${(c.mix * 100).toFixed(0)}% mix) = ${(c.contribution * 100).toFixed(2)}%`,
  );
  const ceilingWhy =
    contributions.length === 0
      ? "No active types, so the engine would not set a finite ceiling."
      : [
          "Ceiling starts from default bases (unless .carf.yml overrode them): infra 1%, dependency 3%, config 5%, code 8%, data 1%.",
          `Each active type is decayed by its own mix: contribution = base × (1 − decay × mix), decay = ${cfg.decay}.`,
          parts.join(". "),
          `The strictest (minimum) of those is ${(minBeforeComplexity * 100).toFixed(2)}% from ${strictestType}.`,
          vector.codeComplexity > 0
            ? `Classifier 2 then multiplies that by (1 − ${cfg.complexityDecay} × ${(vector.codeComplexity * 100).toFixed(0)}/100 complexity) = ${complexityFactor.toFixed(2)}, which is ${(reconstructedThreshold * 100).toFixed(2)}%.`
            : "Classifier 2 did not further shrink the ceiling (complexity was 0).",
          storedMatchesDefaultWalk
            ? `Stored ${ (stored.finalThreshold * 100).toFixed(2) }% matches that default-engine walk (small rounding is normal).`
            : `Stored ${(stored.finalThreshold * 100).toFixed(2)}% may differ because this repo’s .carf.yml overrode bases/decay, or because of rounding.`,
        ].join(" ");

  const windowParts = contributions.map(
    (c) => `${c.type}: ${c.baseWindow}s × (1 − ${cfg.decay} × ${(c.mix * 100).toFixed(0)}%) = ${c.windowContribution.toFixed(0)}s`,
  );
  const windowWhy =
    contributions.length === 0
      ? "No soak window without active types."
      : [
          "Soak window uses the same decay on default windows: infra 60s, dependency 180s, config 300s, code 900s, data 600s.",
          windowParts.join(". "),
          `The shortest window wins: ${Math.round(reconstructedWindow)}s. Complexity does not change the window.`,
          `Stored ${stored.finalWindow}s.`,
        ].join(" ");

  const storedActive = stored.activeTypes.length > 0 ? stored.activeTypes.join(", ") : "none";
  const activeWhy = `Active types are mix bars greater than 0% on this SHA (${storedActive}). Only those types enter the min() for ceiling and window. Zero mix (for example infra 0%) is ignored.`;

  return {
    activeTypes,
    contributions,
    strictestType,
    minBeforeComplexity,
    complexityFactor,
    reconstructedThreshold,
    reconstructedWindow,
    ceilingWhy,
    windowWhy,
    activeWhy,
    storedMatchesDefaultWalk,
  };
}
