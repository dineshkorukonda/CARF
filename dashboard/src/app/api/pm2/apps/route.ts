import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount, listInstallationsForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { ensureCoreApiKey } from "../../../../lib/coreApiAccess";
import { env } from "../../../../config/env";

export async function GET(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const installationId = request.nextUrl.searchParams.get("installationId");
  let installation = null;

  if (installationId) {
    installation = await getInstallationForAccount(prisma, account.id, installationId);
  } else {
    const installations = await listInstallationsForAccount(prisma, account.id);
    installation = installations[0] ?? null;
  }

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
      return NextResponse.json(
        { error: "Failed to fetch PM2 processes from Core API" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error contacting Core API" },
      { status: 500 }
    );
  }
}
