import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { generateInstallToken } from "../../../../lib/agentToken";

/**
 * Generates an installation token for the CARF Host Agent.
 *
 * This endpoint is explicitly Standalone-oriented.
 * It requires an explicit GitHub owner and repository name, and an authorized installation.
 * It NEVER defaults to or creates an implicit "production" repository.
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

  const { installationId, owner, repo } = body;

  const resolvedOwner = typeof owner === "string" ? owner.trim() : "";
  const resolvedRepo = typeof repo === "string" ? repo.trim() : "";

  if (!resolvedOwner || !resolvedRepo) {
    return NextResponse.json(
      { error: "Missing required fields: owner and repo must be non-empty strings" },
      { status: 400 }
    );
  }

  if (!installationId || typeof installationId !== "string" || !installationId.trim()) {
    return NextResponse.json(
      { error: "Missing required field: installationId must be specified" },
      { status: 400 }
    );
  }

  const resolvedInstallationId = installationId.trim();
  const installation = await getInstallationForAccount(prisma, account.id, resolvedInstallationId);
  if (!installation) {
    return NextResponse.json(
      { error: "Installation not found or unauthorized for this account" },
      { status: 404 }
    );
  }

  const { token, hash, prefix } = generateInstallToken();

  const connection = await prisma.repoConnection.upsert({
    where: {
      installationId_owner_repo: {
        installationId: installation.installationId,
        owner: resolvedOwner,
        repo: resolvedRepo,
      },
    },
    create: {
      installationId: installation.installationId,
      owner: resolvedOwner,
      repo: resolvedRepo,
      installTokenHash: hash,
      installTokenPrefix: prefix,
      agentRevoked: false,
    },
    update: {
      installTokenHash: hash,
      installTokenPrefix: prefix,
      agentRevoked: false,
    },
  });

  return NextResponse.json({
    token,
    prefix,
    owner: connection.owner,
    repo: connection.repo,
    installationId: installation.installationId,
  });
}
