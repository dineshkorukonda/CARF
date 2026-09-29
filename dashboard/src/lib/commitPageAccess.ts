/** Which GitHub App installation the dashboard may use to fetch this commit's compare. */
export function pickInstallationIdForCommit(input: {
  commitInstallationId: string | null;
  ownedInstallationIds: string[];
  connectionInstallationId: string | null;
}): string | null {
  const owned = new Set(input.ownedInstallationIds);
  if (input.commitInstallationId) {
    return owned.has(input.commitInstallationId) ? input.commitInstallationId : null;
  }
  if (input.connectionInstallationId && owned.has(input.connectionInstallationId)) {
    return input.connectionInstallationId;
  }
  return null;
}
