import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { generateInstallToken } from "../../../../lib/agentToken";

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

  const { token, hash, prefix } = generateInstallToken();

  const connection = await prisma.repoConnection.upsert({
    where: {
      installationId_owner_repo: {
        installationId,
        owner,
        repo,
      },
    },
    create: {
      installationId,
      owner,
      repo,
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
  });
}
