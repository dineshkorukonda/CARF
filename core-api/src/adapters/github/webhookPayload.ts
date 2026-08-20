export interface DeployTarget {
  owner: string;
  repo: string;
  baseSha: string;
  headSha: string;
  installationId: string;
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
  return { owner, repo, baseSha, headSha, installationId };
}

function parsePullRequest(body: Record<string, unknown>): DeployTarget | null {
  const { owner, repo } = extractRepo(body);
  const installationId = extractInstallationId(body);
  const pullRequest = body.pull_request as { base?: { sha?: string }; head?: { sha?: string } } | undefined;
  const baseSha = pullRequest?.base?.sha;
  const headSha = pullRequest?.head?.sha;

  if (!owner || !repo || !installationId || !baseSha || !headSha) return null;
  return { owner, repo, baseSha, headSha, installationId };
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
