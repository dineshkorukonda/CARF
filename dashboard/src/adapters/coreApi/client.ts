import type { FetchFn } from "../github/fetchTypes";

export interface RecentCommit {
  sha: string;
  owner: string;
  repo: string;
  createdAt: string;
  finalThreshold: number | null;
  finalWindow: number | null;
  activeTypes: string[];
  rolledBack: boolean | null;
  finalErrorRate: number | null;
}

/** `GET {baseUrl}/v1/commits` -- installation-API-key auth (issue #65's mechanism). Used
 *  by the live status view (#64). */
export async function fetchRecentCommits(
  baseUrl: string,
  apiKey: string,
  fetchFn: FetchFn = fetch
): Promise<RecentCommit[]> {
  const response = await fetchFn(`${baseUrl}/v1/commits`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(`core-api commits fetch failed (status ${response.status})`);
  }
  return (await response.json()) as RecentCommit[];
}

/**
 * `GET {baseUrl}/v1/installations/:installationId/api-key` -- core-api's key-issuance
 * endpoint (issue #64). Auth is a GitHub App JWT, not an installation API key (that's
 * exactly what this call is bootstrapping); see appInstallClient.ts's signGithubAppJwt.
 */
export async function fetchInstallationApiKey(
  baseUrl: string,
  installationId: string,
  appJwt: string,
  fetchFn: FetchFn = fetch
): Promise<string> {
  const response = await fetchFn(`${baseUrl}/v1/installations/${installationId}/api-key`, {
    headers: { Authorization: `Bearer ${appJwt}` },
  });
  if (!response.ok) {
    throw new Error(`core-api installation api-key fetch failed (status ${response.status})`);
  }
  const body = (await response.json()) as { apiKey: string };
  return body.apiKey;
}
