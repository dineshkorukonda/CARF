import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { signGithubAppJwt } from "../../../../adapters/github/appInstallClient";
import { createInstallationToken } from "../../../../adapters/github/installationTokenClient";
import {
  getCarfConfigFile,
  deleteCarfConfigFile,
  GitHubContentsError,
} from "../../../../adapters/github/contentsClient";
import { env } from "../../../../config/env";

/**
 * POST /api/repo/unlink
 *
 * Unlinks a repository from CARF by deleting `.carf.yml` on GitHub.
 *
 * Body: { installationId, owner, repo }
 * Response: { success: true, message: string }
 */
export async function POST(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let installationId = "";
  let owner = "";
  let repo = "";

  try {
    const body = await request.json();
    installationId = String(body.installationId ?? "");
    owner = String(body.owner ?? "");
    repo = String(body.repo ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!installationId || !owner || !repo) {
    return NextResponse.json(
      { error: "Missing required fields: installationId, owner, repo" },
      { status: 400 }
    );
  }

  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) {
    return NextResponse.json({ error: "Installation not found or unauthorized" }, { status: 403 });
  }

  try {
    const appJwt = signGithubAppJwt(env.githubAppId(), env.githubAppPrivateKey());
    const { token } = await createInstallationToken(installationId, appJwt);

    const existingFile = await getCarfConfigFile(owner, repo, token);
    if (!existingFile) {
      return NextResponse.json({
        success: true,
        message: `Repository ${owner}/${repo} is already unlinked.`,
      });
    }

    await deleteCarfConfigFile(
      owner,
      repo,
      "chore(carf): unlink repository — remove .carf.yml configuration",
      existingFile.sha,
      token
    );

    return NextResponse.json({
      success: true,
      message: `Successfully unlinked ${owner}/${repo} from CARF.`,
    });
  } catch (error: unknown) {
    console.error("[api/repo/unlink] Failed to delete .carf.yml:", error);
    if (error instanceof GitHubContentsError) {
      return NextResponse.json(
        { error: error.message, reason: error.reason },
        { status: error.status || 500 }
      );
    }
    return NextResponse.json(
      { error: "Failed to unlink repository on GitHub" },
      { status: 500 }
    );
  }
}
