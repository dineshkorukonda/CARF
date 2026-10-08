import type { FetchFn } from "./fetchTypes";
import type { CompareFile } from "./compareClient";

export interface RepositoryPullRequest {
  number: number;
  title: string;
  state: "open" | "closed";
  draft: boolean;
  mergedAt: string | null;
  author: string;
  headSha: string;
  headRef: string;
  baseRef: string;
  updatedAt: string;
}

/** Preserves the original PR diff after merging; GitHub caps this endpoint at 3,000 files. */
export async function listPullRequestFiles(owner: string, repo: string, number: number, token: string, fetchFn: FetchFn = fetch): Promise<CompareFile[]> {
  const files: CompareFile[] = [];
  const signal = AbortSignal.timeout(20_000);
  for (let page = 1; page <= 30; page++) {
    const response = await fetchFn(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}/files?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, signal, cache: "no-store",
    });
    if (!response.ok) throw new Error("Could not load pull request files from GitHub.");
    const batch = await response.json() as CompareFile[];
    files.push(...batch.map(({ filename, status, additions, deletions, previous_filename }) => ({ filename, status, additions, deletions, previous_filename })));
    if (batch.length < 100) break;
  }
  return files;
}

/** Fetch by number so older PRs remain accessible beyond the recent-history page. */
export async function getRepositoryPullRequest(owner: string, repo: string, number: number, token: string, fetchFn: FetchFn = fetch): Promise<RepositoryPullRequest & { baseSha: string }> {
  const response = await fetchFn(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${number}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    signal: AbortSignal.timeout(10_000), cache: "no-store",
  });
  if (!response.ok) throw new Error(response.status === 404 ? "Pull request not found or inaccessible." : "Could not load pull request from GitHub.");
  const pr = await response.json() as {
    number: number; title: string; state: "open" | "closed"; draft?: boolean; merged_at: string | null;
    user: { login: string } | null; head: { sha: string; ref: string }; base: { sha: string; ref: string }; updated_at: string;
  };
  return { number: pr.number, title: pr.title, state: pr.state, draft: Boolean(pr.draft), mergedAt: pr.merged_at,
    author: pr.user?.login ?? "Unknown", headSha: pr.head.sha, headRef: pr.head.ref, baseRef: pr.base.ref, baseSha: pr.base.sha, updatedAt: pr.updated_at };
}

/** One bounded page of recent PRs, including closed/merged PRs. */
export async function listRepositoryPullRequests(owner: string, repo: string, token: string, fetchFn: FetchFn = fetch) {
  const response = await fetchFn(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?state=all&sort=updated&direction=desc&per_page=50`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    signal: AbortSignal.timeout(10_000), cache: "no-store",
  });
  if (!response.ok) throw new Error(response.status === 403 ? "GitHub App needs Pull requests: Read permission." : "Could not load pull requests from GitHub.");
  const body = await response.json() as Array<{
    number: number; title: string; state: "open" | "closed"; draft?: boolean; merged_at: string | null;
    user: { login: string } | null; head: { sha: string; ref: string }; base: { ref: string }; updated_at: string;
  }>;
  const pullRequests: RepositoryPullRequest[] = body.map((pr) => ({
    number: pr.number, title: pr.title, state: pr.state, draft: Boolean(pr.draft), mergedAt: pr.merged_at,
    author: pr.user?.login ?? "Unknown", headSha: pr.head.sha, headRef: pr.head.ref, baseRef: pr.base.ref, updatedAt: pr.updated_at,
  }));
  return { pullRequests, limited: body.length === 50 };
}
