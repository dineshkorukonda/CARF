export type OutcomeState =
  | { kind: "no_signal"; label: "No signal"; description: "Commit touched no sensitive code, config, or infra files." }
  | { kind: "healthy"; label: "Healthy"; description: "Rollout error rate remained below the dynamic threshold." }
  | { kind: "rolled_back"; label: "Rolled back"; errorRate?: number; description: "Dynamic error budget breached. Rollback executed." }
  | { kind: "no_target"; label: "No target configured"; description: "Standalone adapter target not configured or handled externally." }
  | { kind: "pending"; label: "Pending / Augment"; description: "Observation loop in progress, or threshold delegated to external orchestrator." };

export function classifyRolloutOutcome(commit: {
  finalThreshold: number | null | undefined;
  activeTypes: string[];
  rolledBack: boolean | null | undefined;
  finalErrorRate: number | null | undefined;
}): OutcomeState {
  if ((commit.finalThreshold === null || commit.finalThreshold === undefined) && commit.activeTypes.length === 0) {
    return {
      kind: "no_signal",
      label: "No signal",
      description: "Commit touched no sensitive code, config, or infra files.",
    };
  }

  if (commit.rolledBack === true) {
    return {
      kind: "rolled_back",
      label: "Rolled back",
      errorRate: commit.finalErrorRate ?? undefined,
      description: "Dynamic error budget breached. Rollback executed.",
    };
  }

  if (commit.rolledBack === false) {
    return {
      kind: "healthy",
      label: "Healthy",
      description: "Rollout error rate remained below the dynamic threshold.",
    };
  }

  if (commit.finalThreshold !== null && commit.finalThreshold !== undefined && !Number.isFinite(commit.finalThreshold)) {
    return {
      kind: "no_signal",
      label: "No signal",
      description: "Commit touched no sensitive code, config, or infra files.",
    };
  }

  return {
    kind: "pending",
    label: "Pending / Augment",
    description: "Observation loop in progress, or threshold delegated to external orchestrator.",
  };
}
