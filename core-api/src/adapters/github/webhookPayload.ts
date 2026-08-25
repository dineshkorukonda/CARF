export interface DeployTarget {
  owner: string;
  repo: string;
  baseSha: string;
  headSha: string;
  installationId: string;
  /**
   * Which webhook event produced this target. Matters because `baseSha` means different
   * things per event: for `push`, it's `before` -- the branch's actual previous tip, safe
   * to assume as "what's currently deployed". For `pull_request`, it's the PR's base
   * branch tip at open/sync time, which may not reflect what's actually running in
   * production (the base branch can have moved since the last real deploy). Consumers
   * that treat `baseSha` as "the previously deployed commit" (e.g. webhookOrchestrator.ts's
   * DockerComposeAdapter rollback-tag derivation) must check this before doing so.
   */
  event: "push" | "pull_request";
}

interface RepositoryPayload {
  name?: string;
  owner?: { login?: string };
}

function extractRepo(body: Record<string, unknown>): { owner: string | undefined; repo: string | undefined } {
  const repository = body.repository as RepositoryPayload | undefined;
  return { owner: repository?.owner?.login, repo: repository?.name };
}

function extractInstallationId(body: Record<string, unknown>): string | undefined {
  const installation = body.installation as { id?: number } | undefined;
  return installation?.id != null ? String(installation.id) : undefined;
}

function parsePush(body: Record<string, unknown>): DeployTarget | null {
  const { owner, repo } = extractRepo(body);
  const installationId = extractInstallationId(body);
  const baseSha = body.before as string | undefined;
  const headSha = body.after as string | undefined;

  if (!owner || !repo || !installationId || !baseSha || !headSha) return null;
  return { owner, repo, baseSha, headSha, installationId, event: "push" };
}

function parsePullRequest(body: Record<string, unknown>): DeployTarget | null {
  const { owner, repo } = extractRepo(body);
  const installationId = extractInstallationId(body);
  const pullRequest = body.pull_request as { base?: { sha?: string }; head?: { sha?: string } } | undefined;
  const baseSha = pullRequest?.base?.sha;
  const headSha = pullRequest?.head?.sha;

  if (!owner || !repo || !installationId || !baseSha || !headSha) return null;
  return { owner, repo, baseSha, headSha, installationId, event: "pull_request" };
}

/**
 * Extracts { owner, repo, baseSha, headSha, installationId } from a GitHub `push` or
 * `pull_request` webhook payload. Returns null for unsupported event types or payloads
 * missing required fields — callers must not proceed with a partial DeployTarget.
 */
export function parseWebhookPayload(eventName: string, body: Record<string, unknown>): DeployTarget | null {
  switch (eventName) {
    case "push":
      return parsePush(body);
    case "pull_request":
      return parsePullRequest(body);
    default:
      return null;
  }
}
