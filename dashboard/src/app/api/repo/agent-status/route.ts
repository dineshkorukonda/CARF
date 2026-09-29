import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { deriveAgentStatus } from "../../../../lib/repoStatusDerivation";

export async function GET(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const installationId = searchParams.get("installationId");
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");

  if (!installationId || !owner || !repo) {
    return NextResponse.json(
      { error: "Missing required parameters: installationId, owner, repo" },
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
    return NextResponse.json({
      agentStatus: "never-installed",
      agentLastHeartbeat: null,
      verificationReport: null,
      verifiedAt: null,
    });
  }

  const agentStatus = deriveAgentStatus({
    agentLastHeartbeat: connection.agentLastHeartbeat,
    agentRevoked: connection.agentRevoked,
  });

  return NextResponse.json({
    agentStatus,
    agentLastHeartbeat: connection.agentLastHeartbeat,
    agentVersion: connection.agentVersion,
    verificationReport: connection.verificationReport,
    verifiedAt: connection.verifiedAt,
    installTokenPrefix: connection.installTokenPrefix,
  });
}
