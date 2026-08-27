import type { FetchFn } from "./fetchTypes";

const GITHUB_API_BASE = "https://api.github.com";

export interface PublicRepoTreeResult {
  isPrivate: boolean;
  defaultBranch: string;
  truncated: boolean;
  paths: string[];
}

export class RepoNotFoundError extends Error {}

/**
 * Fetches the full recursive file-path listing of a public GitHub repo's default
 * branch, unauthenticated -- works for any public repo without the CARF GitHub App
 * being installed on it yet, since this only reads file *paths* (never content) for
 * the pre-install compatibility check on the dashboard's landing page. GitHub's
 * anonymous rate limit (60 req/hour/IP) is fine for an occasional check like this;
 * revisit if this ever needs to run at higher volume.
 */
export async function fetchPublicRepoTree(
  owner: string,
  repo: string,
  fetchFn: FetchFn = fetch
): Promise<PublicRepoTreeResult> {
  const repoResponse = await fetchFn(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
  });

  if (repoResponse.status === 404) {
    throw new RepoNotFoundError(`${owner}/${repo} not found`);
  }
  if (!repoResponse.ok) {
    throw new Error(`GitHub repo lookup failed (status ${repoResponse.status})`);
  }

  const repoBody = (await repoResponse.json()) as { private: boolean; default_branch: string };

  if (repoBody.private) {
    return { isPrivate: true, defaultBranch: repoBody.default_branch, truncated: false, paths: [] };
  }

  const treeResponse = await fetchFn(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${repoBody.default_branch}?recursive=1`,
    { headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } }
  );

  if (!treeResponse.ok) {
    throw new Error(`GitHub repo tree fetch failed (status ${treeResponse.status})`);
  }

  const treeBody = (await treeResponse.json()) as { tree: { path: string; type: string }[]; truncated: boolean };

  return {
    isPrivate: false,
    defaultBranch: repoBody.default_branch,
    truncated: treeBody.truncated,
    paths: treeBody.tree.filter((entry) => entry.type === "blob").map((entry) => entry.path),
  };
}
