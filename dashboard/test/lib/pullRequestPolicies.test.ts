import { describe, expect, it } from "vitest";
import { attachPullRequestPolicies } from "../../src/lib/pullRequestPolicies";
import type { RepositoryPullRequest } from "../../src/adapters/github/pullRequestsClient";
import { projectSectionsForAnalysis } from "../../src/lib/dashboardNav";

describe("PR history policies and navigation", () => {
  const pr: RepositoryPullRequest = { number: 7, title: "Fix", author: "dev", headSha: "current-head", headRef: "fix", baseRef: "main", state: "open", draft: false, mergedAt: null, updatedAt: "2026-10-08" };
  const policy = { finalThreshold: 0.02, finalWindow: 180, activeTypes: ["code"] };
  it("attaches classification only for the current head", () => {
    const vector = { code: 1, config: 0, infra: 0, data: 0, dependency: 0, codeComplexity: 2 };
    expect(attachPullRequestPolicies([pr], [{ sha: pr.headSha, threshold: policy, changeVector: vector }])[0]!.vector).toEqual(vector);
    expect(attachPullRequestPolicies([pr], [{ sha: "old-head", threshold: policy, changeVector: vector }])[0]).toMatchObject({ vector: null, policy: null });
  });
  it("shows the saved policy for the exact PR head", () => {
    expect(attachPullRequestPolicies([pr], [{ sha: pr.headSha, threshold: policy }])[0]).toMatchObject({ number: 7, title: "Fix", policy });
  });
  it("does not show stale policy after synchronize changes the PR head", () => {
    expect(attachPullRequestPolicies([pr], [{ sha: "old-head", threshold: policy }])[0]!.policy).toBeNull();
  });
  it("keeps unclassified PRs visible", () => {
    expect(attachPullRequestPolicies([pr], [])).toEqual([{ ...pr, policy: null, vector: null }]);
  });
  it("shows PR navigation for PR-only projects and retains both for mixed projects", () => {
    expect(projectSectionsForAnalysis("pull_requests")).toContain("pull_requests");
    expect(projectSectionsForAnalysis("pull_requests")).not.toContain("commits");
    expect(projectSectionsForAnalysis("commits")).not.toContain("pull_requests");
    expect(projectSectionsForAnalysis("both")).toEqual(["overview", "commits", "pull_requests", "rollouts", "activity", "settings"]);
  });
});
