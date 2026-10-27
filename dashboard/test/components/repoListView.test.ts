import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RepoListView } from "../../src/app/dashboard/RepoListView";

vi.stubGlobal("React", React);
vi.mock("../../src/app/dashboard/RolloutOutcomeChart", () => ({ RolloutOutcomeChart: () => null }));

const repos = ["policy", "runtime", "empty"].map((name, index) => ({
  id: index + 1, name, full_name: `acme/${name}`, owner: "acme", default_branch: "main", private: false,
}));
const connections = repos.map((repo) => ({
  id: String(repo.id), installationId: "1", owner: repo.owner, repo: repo.name,
  mode: repo.name === "policy" ? "augment" : "standalone",
  storedConfig: repo.name === "runtime" ? { target: "api-service" } : undefined,
  verifiedAt: null, monitoringPaused: false,
}));
const commit = (id: string, repo: string, createdAt: string) => ({ id, sha: `${id}abcdef123`, owner: "ACME", repo, createdAt });
const rollout = {
  id: "rollout1", commitSha: "rolloutabcdef123", owner: "acme", repo: "runtime", status: "SUCCESS" as const,
  threshold: 0.02, window: 180, startedAt: "2026-10-08", finishedAt: null, rolledBack: false, reason: null,
};

function render(props: Partial<React.ComponentProps<typeof RepoListView>> = {}) {
  return renderToStaticMarkup(React.createElement(RepoListView, {
    repos, connections, commits: [], rollouts: [], ...props,
  }));
}
const cards = (html: string) => Array.from(html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g), (match) => match[1]!);

describe("repository card recent activity", () => {
  it("shows the newest three commits for policy-only repositories, matching identities case-insensitively", () => {
    const [policy] = cards(render({ commits: [
      commit("old", "policy", "2026-10-01"), commit("new", "POLICY", "2026-10-09"),
      commit("middle", "policy", "2026-10-07"), commit("third", "policy", "2026-10-06"),
      commit("foreign", "another-repo", "2026-10-10"),
    ] }));
    expect(policy).toContain("Recent Commits");
    expect(policy).toContain("/dashboard/commits/acme/policy/newabcdef123");
    expect(policy).not.toContain("oldabcdef123");
    expect(policy).not.toContain("foreignabcdef123");
    expect(policy!.indexOf("newabcd")).toBeLessThan(policy!.indexOf("middlea"));
    expect(policy!.indexOf("middlea")).toBeLessThan(policy!.indexOf("thirdab"));
  });

  it("preserves runtime rollout outcomes and keeps each repository's activity separate", () => {
    const [policy, runtime, empty] = cards(render({ rollouts: [rollout], commits: [commit("policy1", "policy", "2026-10-09")] }));
    expect(policy).toContain("Recent Commits");
    expect(policy).not.toContain("rolloutabcdef123");
    expect(runtime).toContain("Recent Rollouts");
    expect(runtime).toContain("Latest: SUCCESS");
    expect(runtime).toContain("/dashboard/commits/acme/runtime/rolloutabcdef123");
    expect(empty).toContain("No activity recorded yet");
  });

  it("shows commits for runtime repositories that have no rollouts yet", () => {
    const runtime = cards(render({ commits: [commit("waiting", "runtime", "2026-10-09")] }))[1];
    expect(runtime).toContain("Recent Commits");
    expect(runtime).toContain("waitingabcdef123");
  });

  it("shows an explicit recent activity section on every empty card", () => {
    for (const card of cards(render())) {
      expect(card).toContain("Recent Commits");
      expect(card).toContain("No activity recorded yet");
    }
  });

  it("distinguishes unavailable history from an empty history", () => {
    for (const card of cards(render({ activityError: "History could not be loaded." }))) {
      expect(card).toContain("Recent activity is unavailable.");
      expect(card).not.toContain("No activity recorded yet");
    }
  });
});

describe("standardized terminology on repository cards", () => {
  it("renders standardized field labels and capabilities", () => {
    const [policy, runtime] = cards(render());
    // Deployment Integration & Runtime Integration labels
    expect(policy).toContain("Deployment Integration");
    expect(policy).toContain("Runtime Integration");
    expect(policy).toContain("Runtime Status");
    expect(policy).toContain("Available Capabilities");
    expect(policy).toContain("Risk Policy");

    // Runtime repo with target
    expect(runtime).toContain("Deployment Integration");
    expect(runtime).toContain("Runtime Integration");
    expect(runtime).toContain("Deployment Target");
    expect(runtime).toContain("api-service");
    expect(runtime).toContain("Runtime Monitoring");
    expect(runtime).toContain("Automated Rollback");
  });
});
