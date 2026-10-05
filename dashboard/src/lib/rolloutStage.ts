export interface RolloutStageInput {
  status: string;
  readyAt?: Date | string | null;
  deployedAt?: Date | string | null;
  rollbackRequestedAt?: Date | string | null;
  rollbackStartedAt?: Date | string | null;
}

export function rolloutStage(rollout: RolloutStageInput | undefined | null, latestCommit = false): string {
  if (!rollout) return latestCommit ? "Waiting for CI / deployment" : "Not deployed";
  if (rollout.status === "SUCCESS") return "Promoted";
  if (rollout.status === "ROLLED_BACK") return "Rolled back";
  if (rollout.status === "FAILED") return "Failed";
  if (rollout.rollbackStartedAt) return "Rolling back";
  if (rollout.rollbackRequestedAt) return "Waiting for rollback job";
  if (rollout.readyAt) return "Observing";
  if (rollout.deployedAt) return "Waiting for PM2 health";
  return "Deploying to PM2";
}
