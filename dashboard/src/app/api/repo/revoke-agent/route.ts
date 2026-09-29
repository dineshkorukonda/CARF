import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";

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

  const connection = await prisma.repoConnection.findUnique({
    where: {
      installationId_owner_repo: {
        installationId,
        owner,
        repo,
      },
    },
  });

  if (!connection) {
    return NextResponse.json({ error: "Repo connection not found" }, { status: 404 });
  }

  await prisma.repoConnection.update({
    where: { id: connection.id },
    data: {
      agentRevoked: true,
      installTokenHash: null,
      installTokenPrefix: null,
    },
  });

  return NextResponse.json({
    success: true,
    agentStatus: "revoked",
    owner,
    repo,
  });
}
