import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount, listInstallationsForAccount } from "../../../../lib/accountService";
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

  let { installationId, owner, repo } = body;

  const defaultOwner = account.name || account.email?.split("@")[0] || "server";
  const resolvedOwner = (owner && owner.trim()) ? owner.trim() : defaultOwner;
  const resolvedRepo = (repo && repo.trim()) ? repo.trim() : "production";

  let installation = null;

  if (installationId) {
    installation = await getInstallationForAccount(prisma, account.id, installationId);
  }

  if (!installation) {
    const existing = await prisma.installation.findFirst({
      where: { userId: account.id },
    });
    if (existing) {
      installation = existing;
    } else {
      const hostInstId = `host_${account.id}`;
      installation = await prisma.installation.upsert({
        where: { installationId: hostInstId },
        create: {
          installationId: hostInstId,
          userId: account.id,
          targetLogin: resolvedOwner,
          targetType: "Host",
          repositorySelection: "all",
        },
        update: {},
      });
    }
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
