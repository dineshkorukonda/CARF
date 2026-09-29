import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { hashInstallToken } from "../../../lib/agentToken";
import type { RepoConnection } from "@prisma/client";

export interface AgentAuthResult {
  connection: RepoConnection;
}

export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization") || request.headers.get("x-carf-install-token");
  if (!authHeader) return null;

  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return authHeader.trim();
}

/**
 * Authenticates an incoming agent request via its installToken.
 * Returns the matched RepoConnection or a NextResponse error.
 */
export async function authenticateAgentRequest(
  request: NextRequest
): Promise<AgentAuthResult | NextResponse> {
  const rawToken = extractBearerToken(request);
  if (!rawToken) {
    return NextResponse.json(
      { error: "Missing install token. Supply Authorization: Bearer <installToken>" },
      { status: 401 }
    );
  }

  const tokenHash = hashInstallToken(rawToken);

  const connection = await prisma.repoConnection.findFirst({
    where: {
      installTokenHash: tokenHash,
      agentRevoked: false,
    },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "Invalid or revoked install token" },
      { status: 401 }
    );
  }

  return { connection };
}
