// Keep initial rendering and live updates compact and identical in shape.
export const commitActivitySelect = {
  id: true, sha: true, createdAt: true,
  threshold: { select: { activeTypes: true, finalThreshold: true, finalWindow: true } },
  changeVector: { select: { code: true, config: true, dependency: true, infra: true } },
} as const;

export const rolloutActivitySelect = {
  id: true, commitSha: true, status: true, threshold: true, window: true,
  startedAt: true, readyAt: true, deployedAt: true, finishedAt: true,
  rolledBack: true, reason: true, rollbackVerified: true,
  rollbackRequestedAt: true, rollbackStartedAt: true,
} as const;
