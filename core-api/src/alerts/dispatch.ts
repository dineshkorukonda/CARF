export interface RollbackAlert {
  owner?: string | null;
  repo?: string | null;
  commitSha: string;
  reason: string;
  finalErrorRate?: number | null;
  rollbackVerified?: boolean | null;
}

export type AlertFetchFn = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<unknown>;

/**
 * Paper Phase 4 (Recovery) alert dispatch. One HTTPS POST to a Slack-compatible
 * incoming webhook or generic JSON receiver. No-ops when webhookUrl is unset so
 * local/dev hosts stay silent.
 */
export async function dispatchRollbackAlert(
  webhookUrl: string | undefined,
  event: RollbackAlert,
  fetchFn: AlertFetchFn = globalThis.fetch
): Promise<void> {
  if (!webhookUrl) {
    return;
  }

  const repoLabel = event.owner && event.repo ? `${event.owner}/${event.repo}` : "unknown-repo";
  const verified =
    event.rollbackVerified === true ? "verified" : event.rollbackVerified === false ? "unverified" : "unknown";
  const body = {
    text: `CARF rollback on ${repoLabel} @ ${event.commitSha}: ${event.reason} (${verified})`,
    ...event,
  };

  await fetchFn(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
