import type { FetchFn } from "./fetchTypes";

const GITHUB_API_BASE = "https://api.github.com";

export interface CompareFile {
  filename: string;
  status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
  additions: number;
  deletions: number;
  previous_filename?: string;
}

export async function getCommitMetadata(
  owner: string,
  repo: string,
  sha: string,
  installationToken: string,
  fetchFn: FetchFn = fetch,
): Promise<{ message: string; author: string }> {
  const response = await fetchFn(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(sha)}`,
    {
      headers: {
        Authorization: `Bearer ${installationToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!response.ok) throw new Error(`GitHub commit lookup failed (status ${response.status})`);
  const body = (await response.json()) as { commit?: { message?: string; author?: { name?: string } }; author?: { login?: string } };
  return { message: body.commit?.message?.split("\n")[0] ?? sha.slice(0, 7), author: body.author?.login ?? body.commit?.author?.name ?? "Unknown author" };
}

/**
 * GET /repos/{owner}/{repo}/compare/{base}...{head} — installation-token auth.
 */
export async function listCompareFiles(
  owner: string,
  repo: string,
  baseSha: string,
  headSha: string,
  installationToken: string,
  fetchFn: FetchFn = fetch,
): Promise<CompareFile[]> {
  const response = await fetchFn(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/compare/${encodeURIComponent(baseSha)}...${encodeURIComponent(headSha)}?per_page=100`,
    {
      headers: {
        Authorization: `Bearer ${installationToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`GitHub compare failed (status ${response.status})`);
  }
  const body = (await response.json()) as { files?: CompareFile[] };
  return body.files ?? [];
}
