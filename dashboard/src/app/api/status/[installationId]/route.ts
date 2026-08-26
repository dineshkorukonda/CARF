import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { ensureCoreApiKey } from "../../../../lib/coreApiAccess";
import { fetchRecentCommits } from "../../../../adapters/coreApi/client";
import { env } from "../../../../config/env";

/**
 * Issue #64's polling endpoint: the status page's client component hits this every N
 * seconds rather than core-api directly, so the installation's core-api key never reaches
 * the browser.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ installationId: string }> }) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const { installationId } = await params;
  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) {
    return NextResponse.json({ error: "not authorized for this installation" }, { status: 403 });
  }

  try {
    const apiKey = await ensureCoreApiKey(prisma, installation);
    const commits = await fetchRecentCommits(env.coreApiBaseUrl(), apiKey, fetch);
    return NextResponse.json({ commits });
  } catch {
    return NextResponse.json({ error: "failed to fetch status from core-api" }, { status: 502 });
  }
}
