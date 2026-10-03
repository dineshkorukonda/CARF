import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function POST(request: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { owner, repo, processName } = body;

    if (!owner || !repo || !processName) {
      return NextResponse.json(
        { error: "owner, repo, and processName are required" },
        { status: 400 }
      );
    }

    const trimmed = String(processName).trim();
    if (!/^[a-zA-Z0-9_\-.:@/]+$/.test(trimmed)) {
      return NextResponse.json(
        { error: "Invalid process name. Contains illegal characters." },
        { status: 400 }
      );
    }

    const existing = await prisma.repoConnection.findFirst({
      where: {
        owner: { equals: owner, mode: "insensitive" },
        repo: { equals: repo, mode: "insensitive" },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Repository connection not found" },
        { status: 404 }
      );
    }

    const currentConfig = (existing.storedConfig ?? {}) as Record<string, unknown>;
    const updatedConfig = {
      ...currentConfig,
      target: trimmed,
      name: trimmed,
    };

    const updated = await prisma.repoConnection.update({
      where: { id: existing.id },
      data: {
        pm2Process: trimmed,
        storedConfig: updatedConfig,
        verifiedAt: existing.verifiedAt ?? new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      pm2Process: updated.pm2Process,
    });
  } catch (error: unknown) {
    console.error("[api/repo/set-process] Error updating process:", error);
    return NextResponse.json(
      { error: "Failed to update PM2 process connection" },
      { status: 500 }
    );
  }
}
