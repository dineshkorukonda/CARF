import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentRequest } from "../auth";
import { prisma } from "../../../../lib/prisma";

export async function POST(request: NextRequest) {
  const auth = await authenticateAgentRequest(request);
  if (auth instanceof NextResponse) return auth;

  const { connection } = auth;

  await prisma.repoConnection.update({
    where: { id: connection.id },
    data: {
      agentRevoked: true,
      installTokenHash: null,
      installTokenPrefix: null,
      agentLastHeartbeat: null,
    },
  });

  return NextResponse.json({
    ok: true,
    message: `Agent for ${connection.owner}/${connection.repo} uninstalled successfully`,
  });
}
