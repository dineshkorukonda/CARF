import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { resolveProjectInstallation } from "../../../../lib/projectAnalysis";
import { mintInstallationToken } from "../../../../lib/installationAccess";
import { listRepositoryPullRequests } from "../../../../adapters/github/pullRequestsClient";
import { attachPullRequestPolicies } from "../../../../lib/pullRequestPolicies";
import { prisma } from "../../../../lib/prisma";

export async function GET(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owner = request.nextUrl.searchParams.get("owner");
  const repo = request.nextUrl.searchParams.get("repo");
  if (!owner || !repo) return NextResponse.json({ error: "Owner and repo required" }, { status: 400 });
  try {
    const installationId = await resolveProjectInstallation(account.id, owner, repo);
    if (!installationId) return NextResponse.json({ error: "Project not authorized" }, { status: 403 });
    const token = await mintInstallationToken(installationId);
    const result = await listRepositoryPullRequests(owner, repo, token);
    const commits = await prisma.commit.findMany({
      where: { installationId, owner: { equals: owner, mode: "insensitive" }, repo: { equals: repo, mode: "insensitive" }, sha: { in: result.pullRequests.map((pr) => pr.headSha) } },
      select: { sha: true, changeVector: { select: { infra: true, dependency: true, config: true, code: true, data: true, codeComplexity: true } }, threshold: { select: { finalThreshold: true, finalWindow: true, activeTypes: true } } },
    });
    return NextResponse.json({ pullRequests: attachPullRequestPolicies(result.pullRequests, commits), limited: result.limited }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pull requests unavailable" }, { status: 502 });
  }
}
