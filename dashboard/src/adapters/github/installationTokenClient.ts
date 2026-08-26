import type { FetchFn } from "./fetchTypes";

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Exchanges a GitHub App JWT (see appInstallClient.ts's signGithubAppJwt) for a
 * short-lived installation access token, scoped to that one installation's repos.
 * Mirrors core-api/src/adapters/github/realInstallationTokenExchangeClient.ts -- same
 * GitHub endpoint, duplicated rather than shared per this package's no-workspace
 * convention (see dashboard/CLAUDE.md).
 */
export async function createInstallationToken(
  installationId: string,
  appJwt: string,
  fetchFn: FetchFn = fetch
): Promise<{ token: string; expiresAt: string }> {
  const response = await fetchFn(`${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appJwt}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub installation token exchange failed (status ${response.status})`);
  }

  const body = (await response.json()) as { token: string; expires_at: string };
  return { token: body.token, expiresAt: body.expires_at };
}
