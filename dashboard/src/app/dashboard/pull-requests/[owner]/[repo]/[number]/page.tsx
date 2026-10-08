import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/auth";
import { resolveProjectInstallation } from "@/lib/projectAnalysis";
import { mintInstallationToken } from "@/lib/installationAccess";
import { prisma } from "@/lib/prisma";
import { getRepositoryPullRequest, listPullRequestFiles } from "@/adapters/github/pullRequestsClient";
import { projectSectionHref } from "@/lib/dashboardNav";
import { CommitPipelineView } from "@/app/dashboard/commits/CommitPipelineView";

export default async function PullRequestPage({ params }: { params: Promise<{ owner: string; repo: string; number: string }> }) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  const raw = await params;
  const owner = decodeURIComponent(raw.owner);
  const repo = decodeURIComponent(raw.repo);
  const number = Number(raw.number);
  if (!owner || !repo || !/^\d+$/.test(raw.number) || !Number.isSafeInteger(number) || number < 1) notFound();
  const installationId = await resolveProjectInstallation(account.id, owner, repo);
  if (!installationId) notFound();
  let pr;
  let token;
  try {
    token = await mintInstallationToken(installationId);
    pr = await getRepositoryPullRequest(owner, repo, number, token);
  } catch {
    return <div className="mx-auto max-w-7xl space-y-4 p-6"><Link href={projectSectionHref(owner, repo, "pull_requests")} className="text-sm text-primary hover:underline">Back to pull requests</Link><p role="alert" className="text-sm text-muted-foreground">Could not load this pull request. Check GitHub App access and try again.</p></div>;
  }
  const commit = await prisma.commit.findFirst({
    where: { installationId, owner: { equals: owner, mode: "insensitive" }, repo: { equals: repo, mode: "insensitive" }, sha: pr.headSha },
    include: { changeVector: true, threshold: true },
  });
  // The PR files endpoint preserves the original diff even after the base branch advances.
  const baseSha = pr.baseSha;
  let files: Awaited<ReturnType<typeof listPullRequestFiles>> = [];
  let filesError: string | null = null;
  try { files = await listPullRequestFiles(owner, repo, number, token); }
  catch { filesError = "Could not load the PR diff from GitHub. Try refreshing the page."; }
  const vector = commit?.changeVector;
  const threshold = commit?.threshold;
  return <CommitPipelineView owner={owner} repo={repo} sha={pr.headSha} baseSha={baseSha} createdAt={pr.updatedAt}
    message={pr.title} author={pr.author} pullRequest={{ number: pr.number, status: pr.mergedAt ? "Merged" : pr.state === "closed" ? "Closed" : pr.draft ? "Draft" : "Open", headRef: pr.headRef, baseRef: pr.baseRef }}
    vector={vector ? { infra: vector.infra, dependency: vector.dependency, config: vector.config, code: vector.code, data: vector.data, codeComplexity: vector.codeComplexity } : null}
    threshold={threshold ? { finalThreshold: threshold.finalThreshold, finalWindow: threshold.finalWindow, activeTypes: threshold.activeTypes } : null}
    rollout={null} files={files} filesError={filesError} />;
}
