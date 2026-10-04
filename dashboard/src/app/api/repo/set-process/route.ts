import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { getInstallationForAccount } from "../../../../lib/accountService";
import {
  attemptAutoRepairSchema,
  mapRawRepoConnection,
} from "../../../../lib/repoConnectionService";

export async function POST(request: NextRequest) {
  try {
    const account = await getCurrentAccount();
    if (!account) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { owner, repo, processName, installationId } = body as {
      owner?: string;
      repo?: string;
      processName?: string;
      installationId?: string;
    };

    if (!owner || !repo || !processName || !installationId) {
      return NextResponse.json(
        { error: "Missing required parameters: owner, repo, processName, installationId" },
        { status: 400 }
      );
    }

    const installation = await getInstallationForAccount(prisma, account.id, installationId);
    if (!installation) return NextResponse.json({ error: "Installation not found or unauthorized" }, { status: 403 });

    const trimmed = String(processName).trim();
    if (!/^[a-zA-Z0-9_\-.:@/]+$/.test(trimmed)) {
      return NextResponse.json(
        { error: "Invalid process name. Contains illegal characters." },
        { status: 400 }
      );
    }

    let existing = null;
    try {
      existing = await prisma.repoConnection.findFirst({
        where: {
          installationId,
          owner: { equals: owner, mode: "insensitive" },
          repo: { equals: repo, mode: "insensitive" },
        },
      });
    } catch {
      await attemptAutoRepairSchema();
    }

    if (!existing) {
      try {
        const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
          `SELECT * FROM "RepoConnection" WHERE lower("owner") = lower($1) AND lower("repo") = lower($2) AND "installationId" = $3 LIMIT 1`,
          owner,
          repo,
          installationId,
        );
        if (rows && rows.length > 0) {
          existing = mapRawRepoConnection(rows[0]!);
        }
      } catch (err) {
        console.warn("[set-process] fallback lookup failed:", err);
      }
    }

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

    try {
      const updated = await prisma.repoConnection.update({
        where: { id: existing.id },
        data: {
          pm2Process: trimmed,
          storedConfig: updatedConfig,
          verifiedAt: null,
        },
      });

      return NextResponse.json({
        success: true,
        pm2Process: updated.pm2Process,
      });
    } catch {
      await attemptAutoRepairSchema();
      try {
        const updated = await prisma.repoConnection.update({
          where: { id: existing.id },
          data: {
            pm2Process: trimmed,
            storedConfig: updatedConfig,
            verifiedAt: null,
          },
        });

        return NextResponse.json({
          success: true,
          pm2Process: updated.pm2Process,
        });
      } catch {
        // Fallback: update storedConfig via raw SQL
        await prisma.$executeRawUnsafe(
          `UPDATE "RepoConnection" SET "storedConfig" = $1::jsonb, "pm2Process" = $3, "verifiedAt" = NULL WHERE "id" = $2`,
          JSON.stringify(updatedConfig),
          existing.id,
          trimmed,
        );
        return NextResponse.json({
          success: true,
          pm2Process: trimmed,
        });
      }
    }
  } catch (error: unknown) {
    console.error("[api/repo/set-process] Error updating process:", error);
    return NextResponse.json(
      { error: "Failed to update PM2 process connection" },
      { status: 500 }
    );
  }
}
