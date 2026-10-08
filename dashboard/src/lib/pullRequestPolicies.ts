import type { RepositoryPullRequest } from "../adapters/github/pullRequestsClient";

export interface HeadPolicy {
  finalThreshold: number; finalWindow: number; activeTypes: string[];
}
export interface HeadVector { infra: number; dependency: number; config: number; code: number; data: number; codeComplexity: number }
export interface PullRequestWithPolicy extends RepositoryPullRequest { policy: HeadPolicy | null; vector: HeadVector | null }

/** Policies are SHA-based; never show a previous PR head's policy as current. */
export function attachPullRequestPolicies(prs: RepositoryPullRequest[], commits: Array<{ sha: string; threshold: HeadPolicy | null; changeVector?: HeadVector | null }>): PullRequestWithPolicy[] {
  const policies = new Map(commits.map((commit) => [commit.sha, commit]));
  return prs.map((pr) => ({ ...pr, policy: policies.get(pr.headSha)?.threshold ?? null, vector: policies.get(pr.headSha)?.changeVector ?? null }));
}
