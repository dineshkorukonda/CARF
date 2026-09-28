import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { ensureCoreApiKey } from "../../../../lib/coreApiAccess";
import { env } from "../../../../config/env";

export async function GET(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const installationId = request.nextUrl.searchParams.get("installationId");
  if (!installationId) {
    return NextResponse.json({ error: "Missing installationId" }, { status: 400 });
  }

  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) {
    return NextResponse.json({ error: "Installation not found" }, { status: 404 });
  }

  try {
    const apiKey = await ensureCoreApiKey(prisma, installation);
    const coreUrl = `${env.coreApiBaseUrl()}/v1/pm2/apps`;
    const res = await fetch(coreUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Core API returned ${res.status}: ${err}` }, { status: res.status });
    }

    const apps = await res.json();
    return NextResponse.json({ apps });
  } catch (err: unknown) {
    console.error("[api/pm2/apps] Error:", err);
    return NextResponse.json({ error: "Failed to query PM2 apps from core API" }, { status: 502 });
  }
}
