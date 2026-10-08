import type { FetchFn } from "./fetchTypes";

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
