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
export interface RefreshCommitsResult {
  pulled: Array<{ sha: string; baseSha: string }>;
  alreadyKnown: number;
  failed: Array<{ sha: string; error: string }>;
  soakSha?: string | null;
  skipped?: Array<{ sha: string; reason: string }>;
}

/** `POST {baseUrl}/v1/commits/refresh` — classify branch commits the webhook tip skipped. */
export async function refreshRepoCommits(
  baseUrl: string,
  apiKey: string,
  body: { owner: string; repo: string; branch: string; observeLive?: boolean },
  fetchFn: FetchFn = fetch
): Promise<RefreshCommitsResult> {
  const response = await fetchFn(`${baseUrl}/v1/commits/refresh`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ ...body, observeLive: false }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`core-api commit refresh failed (status ${response.status}): ${detail}`);
  }
  return (await response.json()) as RefreshCommitsResult;
}

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

export interface CoreApiVersionInfo {
  status: string;
  service: string;
  version: string;
  uptime?: number;
  nodeVersion?: string;
  timestamp?: string;
}

/**
 * `GET {baseUrl}/v1/version` -- fetch core-api service status and version information.
 */
export async function fetchCoreApiVersion(
  baseUrl: string,
  fetchFn: FetchFn = fetch
): Promise<CoreApiVersionInfo> {
  const normalized = baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
  const response = await fetchFn(`${normalized}/v1/version`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`core-api version fetch failed (status ${response.status})`);
  }
  return (await response.json()) as CoreApiVersionInfo;
}
