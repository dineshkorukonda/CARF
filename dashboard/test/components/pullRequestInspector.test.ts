import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CommitPipelineView, type CommitPipelineData } from "../../src/app/dashboard/commits/CommitPipelineView";

vi.stubGlobal("React", React);
const data: CommitPipelineData = {
  owner: "acme", repo: "app", sha: "head123456", baseSha: "base123456", author: "dev", message: "Fix health checks", createdAt: "2026-10-08",
  vector: { code: 1, infra: 0, dependency: 0, config: 0, data: 0, codeComplexity: 0.2 },
  threshold: { finalThreshold: 0.02, finalWindow: 180, activeTypes: ["code"] }, rollout: null,
  files: [{ filename: "src/server.ts", status: "modified", additions: 2, deletions: 1 }], filesError: null,
};
describe("shared PR and commit inspector", () => {
  it("renders PR identity, classification, policy and PR navigation", () => {
    const html = renderToStaticMarkup(React.createElement(CommitPipelineView, { ...data, pullRequest: { number: 217, status: "Merged", headRef: "fix", baseRef: "main" } }));
    expect(html).toContain("#217"); expect(html).toContain("src/server.ts"); expect(html).toContain("2.00%");
    expect(html).toContain("/dashboard/repos/acme/app?view=pull_requests"); expect(html).toContain("https://github.com/acme/app/pull/217");
    expect(html).toContain("Pull request intake"); expect(html).toContain("Threshold engine"); expect(html).not.toContain("Rollback decision"); expect(html).not.toContain("Observed error rate");
  });
  it("preserves the commit inspector's rollout and observation panels", () => {
    const html = renderToStaticMarkup(React.createElement(CommitPipelineView, data));
    expect(html).toContain("Rollback decision"); expect(html).toContain("Observed error rate"); expect(html).toContain("/dashboard/repos/acme/app?view=commits");
  });
});
