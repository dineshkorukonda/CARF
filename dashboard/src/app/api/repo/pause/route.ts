import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";

export async function POST(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { installationId, owner, repo, paused } = (body || {}) as {
    installationId?: string;
    owner?: string;
    repo?: string;
    paused?: boolean;
  };
  if (!installationId || !owner || !repo || typeof paused !== "boolean") {
    return NextResponse.json(
      { error: "Missing required fields: installationId, owner, repo, and boolean paused" },
      { status: 400 }
    );
  }

  const installation = await getInstallationForAccount(prisma, account.id, String(installationId));
  if (!installation) {
    return NextResponse.json({ error: "Installation not found or unauthorized" }, { status: 404 });
  }

  try {
    const updated = await prisma.repoConnection.upsert({
      where: {
        installationId_owner_repo: {
          installationId: String(installationId),
          owner,
          repo,
        },
      },
      create: {
        installationId: String(installationId),
        owner,
        repo,
        monitoringPaused: paused,
      },
      update: {
        monitoringPaused: paused,
      },
    });

    return NextResponse.json({
      success: true,
      monitoringPaused: updated.monitoringPaused,
    });
  } catch (err: unknown) {
    console.error("[api/repo/pause] Error:", err);
    return NextResponse.json({ error: "Failed to update monitoring pause state" }, { status: 500 });
  }
}
