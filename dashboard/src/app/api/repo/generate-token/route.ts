import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { generateInstallToken } from "../../../../lib/agentToken";
import { resolveRepoMode } from "../../../../lib/deploymentMode";
import { resolveFromLegacy } from "../../../../lib/capabilities";

/**
 * Regenerates a Host Agent install token for an existing Standalone repository.
 *
 * Never creates a RepoConnection. Never invents owner/repo defaults
 * (including "production"). Repositories without active runtime adapters cannot mint agent tokens.
 */
export async function POST(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { installationId?: string; owner?: string; repo?: string } = {};
  try {
    body = (await request.json()) as { installationId?: string; owner?: string; repo?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const resolvedOwner = typeof body.owner === "string" ? body.owner.trim() : "";
  const resolvedRepo = typeof body.repo === "string" ? body.repo.trim() : "";
  const resolvedInstallationId = typeof body.installationId === "string" ? body.installationId.trim() : "";

  if (!resolvedOwner || !resolvedRepo) {
    return NextResponse.json(
      { error: "Missing required fields: owner and repo must be non-empty strings" },
      { status: 400 }
    );
  }

  if (!resolvedInstallationId) {
    return NextResponse.json(
      { error: "Missing required field: installationId must be specified" },
      { status: 400 }
    );
  }

  const installation = await getInstallationForAccount(prisma, account.id, resolvedInstallationId);
  if (!installation) {
    return NextResponse.json(
      { error: "Installation not found or unauthorized for this account" },
      { status: 404 }
    );
  }

  const connection = await prisma.repoConnection.findUnique({
    where: {
      installationId_owner_repo: {
        installationId: installation.installationId,
        owner: resolvedOwner,
        repo: resolvedRepo,
      },
    },
  });

  if (!connection) {
    return NextResponse.json(
      {
        error:
          "Repository is not linked yet. Complete Standalone setup before generating a host agent token.",
      },
      { status: 404 }
    );
  }

  const resolved = resolveFromLegacy(connection);
  if (!resolved.requiresAgent && resolveRepoMode(connection) !== "standalone") {
    return NextResponse.json(
      { error: "Host agent tokens are only issued for Standalone repositories." },
      { status: 400 }
    );
  }

  const { token, hash, prefix } = generateInstallToken();

  const updated = await prisma.repoConnection.update({
    where: { id: connection.id },
    data: {
      installTokenHash: hash,
      installTokenPrefix: prefix,
      agentRevoked: false,
    },
  });

  return NextResponse.json({
    token,
    prefix,
    owner: updated.owner,
    repo: updated.repo,
    installationId: installation.installationId,
    mode: "standalone",
    deploymentIntegration: resolved.deploymentIntegration,
    runtimeAdapter: resolved.runtimeAdapter,
  });
}
