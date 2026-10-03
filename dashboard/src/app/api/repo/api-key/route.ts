import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { ensureCoreApiKey } from "../../../../lib/coreApiAccess";

/**
 * Returns the installation API key for an explicit copy action.
 * The key is never rendered into normal page HTML.
 */
export async function POST(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { installationId?: string };
  try {
    body = (await request.json()) as { installationId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const installationId = typeof body.installationId === "string" ? body.installationId.trim() : "";
  if (!installationId) {
    return NextResponse.json({ error: "Missing required field: installationId" }, { status: 400 });
  }

  const installation = await getInstallationForAccount(prisma, account.id, installationId);
  if (!installation) {
    return NextResponse.json({ error: "Installation not found or unauthorized" }, { status: 404 });
  }

  try {
    const apiKey = await ensureCoreApiKey(prisma, installation);
    return NextResponse.json({
      prefix: `${apiKey.slice(0, 8)}…`,
      apiKey,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load API key" },
      { status: 502 }
    );
  }
}
