import type { RepositoryPullRequest } from "../adapters/github/pullRequestsClient";

export interface HeadPolicy {
  finalThreshold: number; finalWindow: number; activeTypes: string[];
}
export interface PullRequestWithPolicy extends RepositoryPullRequest { policy: HeadPolicy | null }

/** Policies are SHA-based; never show a previous PR head's policy as current. */
export function attachPullRequestPolicies(prs: RepositoryPullRequest[], commits: Array<{ sha: string; threshold: HeadPolicy | null }>): PullRequestWithPolicy[] {
  const policies = new Map(commits.map((commit) => [commit.sha, commit.threshold]));
  return prs.map((pr) => ({ ...pr, policy: policies.get(pr.headSha) ?? null }));
}
