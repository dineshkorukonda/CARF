import { NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { listInstallationsForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { ensureCoreApiKey } from "../../../../lib/coreApiAccess";
import { fetchRecentCommits, type RecentCommit } from "../../../../adapters/coreApi/client";
import { env } from "../../../../config/env";
import { mintInstallationToken } from "../../../../lib/installationAccess";
import { listInstallationRepos } from "../../../../adapters/github/reposClient";
import { getCarfConfigFile } from "../../../../adapters/github/contentsClient";
import { evaluateCompatibility } from "../../../../lib/compatCheck";
import { fetchPublicRepoTree } from "../../../../adapters/github/publicRepoTreeClient";

export async function GET() {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const installations = await listInstallationsForAccount(prisma, account.id);
  const hasInstallations = installations.length > 0;

  if (!hasInstallations) {
    return NextResponse.json({
      currentStep: 1,
      step1: { completed: false },
      step2: { completed: false },
      step3: { completed: false },
      step4: { completed: false },
      step5: { completed: false },
    });
  }

  const primary = installations[0]!;
  let repos: { name: string; full_name: string }[] = [];
  let token: string | null = null;
  try {
    token = await mintInstallationToken(primary.installationId);
    repos = await listInstallationRepos(token);
  } catch {
    // Non-fatal
  }

  const selectedRepo = repos[0];
  let configFileExists = false;
  let compatReport = null;

  if (selectedRepo && token) {
    try {
      const [owner, repoName] = selectedRepo.full_name.split("/");
      const file = await getCarfConfigFile(owner!, repoName!, token);
      configFileExists = !!file;
    } catch {
      // Non-fatal
    }

    try {
      const [owner, repoName] = selectedRepo.full_name.split("/");
      const tree = await fetchPublicRepoTree(owner!, repoName!);
      compatReport = evaluateCompatibility(tree.paths);
    } catch {
      // Fallback
    }
  }

  let commits: RecentCommit[] = [];
  try {
    const apiKey = await ensureCoreApiKey(prisma, primary);
    commits = await fetchRecentCommits(env.coreApiBaseUrl(), apiKey);
  } catch {
    // Non-fatal
  }

  const firstClassifiedCommit = commits.find((c) => c.finalThreshold !== null || c.activeTypes.length > 0);

  let currentStep = 1;
  if (!hasInstallations) currentStep = 1;
  else if (repos.length === 0) currentStep = 2;
  else if (!compatReport) currentStep = 3;
  else if (!configFileExists) currentStep = 4;
  else currentStep = 5;

  return NextResponse.json({
    currentStep,
    installationId: primary.installationId,
    repo: selectedRepo ? selectedRepo.full_name : null,
    repos,
    step1: { completed: true },
    step2: { completed: repos.length > 0, repoCount: repos.length },
    step3: { completed: !!compatReport, report: compatReport },
    step4: { completed: configFileExists },
    step5: {
      completed: !!firstClassifiedCommit,
      commit: firstClassifiedCommit ?? null,
      totalCommits: commits.length,
    },
  });
}
