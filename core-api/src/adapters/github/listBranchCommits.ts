import type { FetchFn } from "./fetchTypes.js";
import type { ListedCommit } from "../../commits/selectMissingCommits.js";

const GITHUB_API_BASE = "https://api.github.com";

const DEFAULT_LIMIT = 30;

/**
 * Recent commits on `branch`, newest first. One page only — refresh is meant to
 * backfill a short gap (a push whose intermediate SHAs were not the webhook head),
 * not the full history.
 */
export async function listBranchCommits(
  owner: string,
  repo: string,
  branch: string,
  token: string,
  fetchFn: FetchFn = fetch,
  limit: number = DEFAULT_LIMIT,
): Promise<ListedCommit[]> {
  const url =
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits` +
    `?sha=${encodeURIComponent(branch)}&per_page=${limit}`;
  const response = await fetchFn(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GitHub list commits failed (status ${response.status}): ${message}`);
  }

  const body = (await response.json()) as Array<{ sha?: string; parents?: Array<{ sha?: string }> }>;
  return body.flatMap((commit) => {
    if (!commit.sha) return [];
    const parentSha = commit.parents?.[0]?.sha ?? null;
    return [{ sha: commit.sha, parentSha }];
  });
}
