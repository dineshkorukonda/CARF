export type RollbackDecisionKind =
  | "rolled_back"
  | "observing"
  | "not_needed"
  | "failed"
  | "no_signal"
  | "awaiting";

export interface RollbackDecision {
  kind: RollbackDecisionKind;
  title: string;
  detail: string;
}

export interface PipelineStep {
  id: string;
  title: string;
  status: "done" | "current" | "pending" | "skipped";
  summary: string;
}

export function rollbackDecision(input: {
  hasVector: boolean;
  rolloutStatus: "PENDING" | "SUCCESS" | "ROLLED_BACK" | "FAILED" | null;
  reason: string | null;
  rollbackRequestedAt?: Date | string | null;
  rollbackStartedAt?: Date | string | null;
}): RollbackDecision {
  if (!input.hasVector) {
    return {
      kind: "no_signal",
      title: "Rollback not evaluated",
      detail: "Classifier 1 found no signal (docs/images only, or empty classified set). Threshold engine skipped this commit.",
    };
  }
  if (input.rolloutStatus === "ROLLED_BACK") {
    return {
      kind: "rolled_back",
      title: "Rollback was necessary",
      detail: input.reason || "Standalone observation breached the calibrated threshold and CARF rolled back.",
    };
  }
  if (input.rolloutStatus === "PENDING") {
    if (input.rollbackRequestedAt) {
      return {
        kind: "observing",
        title: input.rollbackStartedAt ? "GitHub Actions is rolling back" : "Rollback required — awaiting GitHub Actions",
        detail: input.reason || "The rollback job will restore the previous revision and verify its health.",
      };
    }
    return {
      kind: "observing",
      title: "Observing — rollback not decided yet",
      detail: "The soak window is still open. CARF will roll back only if live error rate exceeds the threshold.",
    };
  }
  if (input.rolloutStatus === "FAILED") {
    return {
      kind: "failed",
      title: "Adapter error",
      detail: input.reason || "The PM2 adapter failed while observing or rolling back.",
    };
  }
  if (input.rolloutStatus === "SUCCESS") {
    return {
      kind: "not_needed",
      title: "Rollback not necessary",
      detail: "Observation finished inside the threshold. The commit stayed live.",
    };
  }
  return {
    kind: "awaiting",
    title: "Not watching live yet",
    detail: "This SHA is classified. Soak and rollback only start after that commit is what PM2 is actually running (pull/deploy on the host CARF is configured to watch).",
  };
}

export function pipelineSteps(input: {
  hasCommit: boolean;
  hasVector: boolean;
  hasThreshold: boolean;
  rolloutStatus: "PENDING" | "SUCCESS" | "ROLLED_BACK" | "FAILED" | null;
}): PipelineStep[] {
  const afterThreshold: PipelineStep["status"] = !input.hasThreshold
    ? "pending"
    : input.rolloutStatus
      ? "done"
      : "current";
  return [
    {
      id: "intake",
      title: "Commit intake",
      status: input.hasCommit ? "done" : "pending",
      summary: "Webhook recorded this SHA in Postgres.",
    },
    {
      id: "tier1",
      title: "Classifier 1 — path types",
      status: input.hasVector ? "done" : input.hasCommit ? "skipped" : "pending",
      summary: input.hasVector
        ? "Each changed path was typed (infra, dependency, config, code, data)."
        : "No classified files — vector was not stored.",
    },
    {
      id: "tier2",
      title: "Classifier 2 — code complexity",
      status: input.hasVector ? "done" : "skipped",
      summary: "AST complexity for code/test files, stored as codeComplexity on the change vector.",
    },
    {
      id: "threshold",
      title: "Threshold engine",
      status: input.hasThreshold ? "done" : input.hasVector ? "current" : "skipped",
      summary: "Calibrated error-rate ceiling and soak window from the vector.",
    },
    {
      id: "rollback",
      title: "Rollback decision",
      status: afterThreshold,
      summary: "Standalone observation compares live error rate to that ceiling.",
    },
  ];
}
