import { NextRequest, NextResponse } from "next/server";
import { refreshRepoCommits } from "../../../../adapters/coreApi/client";
import { env } from "../../../../config/env";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { ensureCoreApiKey } from "../../../../lib/coreApiAccess";
import { prisma } from "../../../../lib/prisma";

/**
 * Pulls recent commits on the repo's default branch that a push webhook never
 * classified (only the tip of a multi-commit push is delivered) and asks core-api
 * to classify them. Does not start a live rollback watch.
 */
export async function POST(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { installationId?: unknown; owner?: unknown; repo?: unknown; branch?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const installationId = typeof body.installationId === "string" ? body.installationId : "";
  const owner = typeof body.owner === "string" ? body.owner.trim() : "";
  const repo = typeof body.repo === "string" ? body.repo.trim() : "";
  const branch = typeof body.branch === "string" && body.branch.trim() ? body.branch.trim() : "main";
  if (!installationId || !owner || !repo) {
    return NextResponse.json({ error: "installationId, owner, and repo are required" }, { status: 400 });
  }

  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) {
    return NextResponse.json({ error: "Installation not found or unauthorized" }, { status: 404 });
  }

  try {
    const apiKey = await ensureCoreApiKey(prisma, installation);
    const result = await refreshRepoCommits(env.coreApiBaseUrl(), apiKey, { owner, repo, branch });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/repo/refresh-commits] failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "failed to refresh commits" },
      { status: 502 },
    );
  }
}
