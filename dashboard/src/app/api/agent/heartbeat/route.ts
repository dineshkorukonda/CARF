import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentRequest } from "../auth";
import { prisma } from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";

interface VerificationCheckItem {
  id: string;
  title: string;
  passed: boolean;
  message: string;
}

interface HeartbeatBody {
  version?: string;
  checks?: VerificationCheckItem[];
}

export async function POST(request: NextRequest) {
  const auth = await authenticateAgentRequest(request);
  if (auth instanceof NextResponse) return auth;

  const { connection } = auth;
  let body: HeartbeatBody = {};
  try {
    body = (await request.json()) as HeartbeatBody;
  } catch {
    // Empty body is acceptable for a bare heartbeat ping
  }

  const now = new Date();
  const updateData: Prisma.RepoConnectionUpdateInput = {
    agentLastHeartbeat: now,
  };

  if (body.version && typeof body.version === "string") {
    updateData.agentVersion = body.version.slice(0, 64);
  }

  if (Array.isArray(body.checks)) {
    const checks = body.checks;
    updateData.verificationReport = JSON.parse(JSON.stringify(checks)) as Prisma.InputJsonValue;
    const allPassed = checks.length > 0 && checks.every((c) => Boolean(c.passed));
    if (allPassed) {
      updateData.verifiedAt = now;
    }
  }

  await prisma.repoConnection.update({
    where: { id: connection.id },
    data: updateData,
  });

  return NextResponse.json({
    ok: true,
    status: "online",
    timestamp: now.toISOString(),
    owner: connection.owner,
    repo: connection.repo,
  });
}
