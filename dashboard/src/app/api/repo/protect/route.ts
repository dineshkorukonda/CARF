import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { mintInstallationToken } from "../../../../lib/installationAccess";
import {
  getCarfConfigFile,
  putCarfConfigFile,
  getRepoFile,
  putRepoFile,
  GitHubContentsError,
} from "../../../../adapters/github/contentsClient";
import {
  type ProtectionPreset,
  generateCarfYaml,
  generateWatchdogWorkflowYaml,
} from "../../../../lib/repoProtectionTemplates";

export async function POST(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let installationId = "";
  let owner = "";
  let repo = "";
  let preset: ProtectionPreset = "standard";
  let includeWorkflow = true;

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json();
    installationId = String(body.installationId || "");
    owner = String(body.owner || "");
    repo = String(body.repo || "");
    if (body.preset === "conservative" || body.preset === "aggressive" || body.preset === "standard") {
      preset = body.preset;
    }
    if (typeof body.includeWorkflow === "boolean") {
      includeWorkflow = body.includeWorkflow;
    }
  } else {
    const formData = await request.formData();
    installationId = String(formData.get("installationId") || "");
    owner = String(formData.get("owner") || "");
    repo = String(formData.get("repo") || "");
    const formPreset = String(formData.get("preset") || "");
    if (formPreset === "conservative" || formPreset === "aggressive" || formPreset === "standard") {
      preset = formPreset;
    }
    includeWorkflow = formData.get("includeWorkflow") !== "false";
  }

  if (!installationId || !owner || !repo) {
    return NextResponse.json({ error: "Missing required parameters: installationId, owner, repo" }, { status: 400 });
  }

  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) {
    return NextResponse.json({ error: "Installation not found or unauthorized" }, { status: 403 });
  }

  try {
    const token = await mintInstallationToken(installationId);
    const filesCommitted: string[] = [];

    // 1. Check existing .carf.yml and commit
    const existingConfig = await getCarfConfigFile(owner, repo, token);
    const carfYaml = generateCarfYaml(preset);
    await putCarfConfigFile(
      owner,
      repo,
      carfYaml,
      "chore(carf): enable 1-click change-aware rollback protection (.carf.yml)",
      token,
      existingConfig?.sha
    );
    filesCommitted.push(".carf.yml");

    // 2. Commit GitHub Actions Watchdog workflow if requested
    let warning: string | undefined;
    if (includeWorkflow) {
      try {
        const workflowPath = ".github/workflows/carf.yml";
        const existingWorkflow = await getRepoFile(owner, repo, workflowPath, token);
        const workflowYaml = generateWatchdogWorkflowYaml();
        await putRepoFile(
          owner,
          repo,
          workflowPath,
          workflowYaml,
          "ci(carf): add dynamic canary watchdog workflow (.github/workflows/carf.yml)",
          token,
          existingWorkflow?.sha
        );
        filesCommitted.push(workflowPath);
      } catch (workflowErr: unknown) {
        if (workflowErr instanceof GitHubContentsError && workflowErr.status === 403) {
          warning = "GitHub App is missing 'Workflows: Read and write' permissions. .carf.yml was committed, but the workflow file could not be added.";
        } else {
          throw workflowErr;
        }
      }
    }

    return NextResponse.json({
      success: true,
      repo: `${owner}/${repo}`,
      filesCommitted,
      warning,
      message: `Repository ${owner}/${repo} successfully protected with CARF dynamic thresholds.`,
    });
  } catch (error: unknown) {
    console.error("[api/repo/protect] Protection failed:", error);
    if (error instanceof GitHubContentsError) {
      return NextResponse.json(
        {
          error: error.message,
          reason: error.reason,
          status: error.status,
        },
        { status: error.status || 500 }
      );
    }
    return NextResponse.json(
      { error: "Failed to protect repository via GitHub API" },
      { status: 500 }
    );
  }
}
