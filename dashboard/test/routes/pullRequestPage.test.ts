import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ account: vi.fn(), access: vi.fn(), pr: vi.fn(), commit: vi.fn(), files: vi.fn() }));
vi.stubGlobal("React", React);
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(path); }, notFound: () => { throw new Error("404"); } }));
vi.mock("@/lib/auth", () => ({ getCurrentAccount: mocks.account }));
vi.mock("@/lib/projectAnalysis", () => ({ resolveProjectInstallation: mocks.access }));
vi.mock("@/lib/installationAccess", () => ({ mintInstallationToken: async () => "token" }));
vi.mock("@/adapters/github/pullRequestsClient", () => ({ getRepositoryPullRequest: mocks.pr, listPullRequestFiles: mocks.files }));
vi.mock("@/lib/prisma", () => ({ prisma: { commit: { findFirst: mocks.commit } } }));
vi.mock("@/app/dashboard/commits/CommitPipelineView", () => ({ CommitPipelineView: () => null }));
const { default: page } = await import("../../src/app/dashboard/pull-requests/[owner]/[repo]/[number]/page");
const render = (number = "217") => page({ params: Promise.resolve({ owner: "acme", repo: "app", number }) });

describe("PR analysis page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.account.mockResolvedValue({ id: "account" }); mocks.access.mockResolvedValue("123");
    mocks.pr.mockResolvedValue({ number: 217, title: "Fix", author: "dev", headSha: "current", baseSha: "base", headRef: "fix", baseRef: "main", state: "open", updatedAt: "2026-10-08" });
    mocks.commit.mockResolvedValue(null); mocks.files.mockResolvedValue([]);
  });
  it("requires authentication before reading GitHub", async () => {
    mocks.account.mockResolvedValue(null); await expect(render()).rejects.toThrow("/login"); expect(mocks.pr).not.toHaveBeenCalled();
  });
  it("rejects inaccessible repositories and invalid numbers", async () => {
    await expect(render("0")).rejects.toThrow("404"); await expect(render("1e2")).rejects.toThrow("404");
    mocks.access.mockResolvedValue(null); await expect(render()).rejects.toThrow("404"); expect(mocks.pr).not.toHaveBeenCalled();
  });
  it("scopes saved analysis to the installation and exact current head", async () => {
    const element = await render();
    expect(mocks.commit).toHaveBeenCalledWith({ where: { installationId: "123", owner: { equals: "acme", mode: "insensitive" }, repo: { equals: "app", mode: "insensitive" }, sha: "current" }, include: { changeVector: true, threshold: true } });
    expect(element.props).toMatchObject({ sha: "current", threshold: null, vector: null, rollout: null, pullRequest: { number: 217, status: "Open" } });
  });
  it("shows the full PR comparison even when the saved SHA record has a different base", async () => {
    mocks.commit.mockResolvedValue({ baseSha: "previous-commit", threshold: { finalThreshold: 0.02, finalWindow: 180, activeTypes: ["code"] } });
    const element = await render();
    expect(mocks.files).toHaveBeenCalledWith("acme", "app", 217, "token");
    expect(element.props.threshold.finalThreshold).toBe(0.02);
  });
  it("retains the analysis when GitHub diff loading fails", async () => {
    mocks.files.mockRejectedValue(new Error("unavailable")); expect((await render()).props.filesError).toContain("Could not load the PR diff");
  });
  it("renders a recoverable error when PR metadata is inaccessible", async () => {
    mocks.pr.mockRejectedValue(new Error("404")); const element = await render();
    expect(element.props.children[1].props.role).toBe("alert"); expect(mocks.commit).not.toHaveBeenCalled();
  });
});
