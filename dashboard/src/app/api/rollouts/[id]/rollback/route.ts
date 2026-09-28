import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../../lib/auth";
import { getInstallationForAccount } from "../../../../../lib/accountService";
import { prisma } from "../../../../../lib/prisma";
import { ensureCoreApiKey } from "../../../../../lib/coreApiAccess";
import { env } from "../../../../../config/env";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const installationId = request.nextUrl.searchParams.get("installationId");

  if (!installationId) {
    return NextResponse.json({ error: "Missing installationId query parameter" }, { status: 400 });
  }

  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) {
    return NextResponse.json({ error: "Installation not found or unauthorized" }, { status: 404 });
  }

  try {
    const apiKey = await ensureCoreApiKey(prisma, installation);
    const coreUrl = `${env.coreApiBaseUrl()}/v1/rollouts/${encodeURIComponent(id)}/rollback`;
    const res = await fetch(coreUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    console.error(`[api/rollouts/${id}/rollback] Error:`, err);
    return NextResponse.json({ error: "Failed to trigger manual rollback via core API" }, { status: 502 });
  }
}
