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

  const { searchParams } = request.nextUrl;
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const installationId = searchParams.get("installationId");

  const installation = installationId
    ? await getInstallationForAccount(prisma, account.id, installationId)
    : (await listInstallationsForAccount(prisma, account.id))[0] ?? null;

  // Determine repository's configured PM2 process name
  let targetProcess: string | null = null;
  if (owner && repo && installation) {
    const connection = await prisma.repoConnection.findFirst({
      where: {
        installationId: installation.installationId,
        owner: { equals: owner, mode: "insensitive" },
        repo: { equals: repo, mode: "insensitive" },
      },
    });

    const storedConfig = (connection?.storedConfig ?? {}) as Record<string, unknown>;
    targetProcess =
      connection?.pm2Process ??
      (typeof storedConfig.target === "string" ? storedConfig.target : null) ??
      (typeof storedConfig.name === "string" ? storedConfig.name : null) ??
      null;
  }

  if (!installation) {
    return NextResponse.json(
      {
        runtime: "pm2",
        connected: false,
        processName: targetProcess,
        processFound: false,
        process: null,
        processes: [],
        error: "No GitHub installation configured for authentication",
      },
      { status: 200 }
    );
  }

  try {
    const apiKey = await ensureCoreApiKey(prisma, installation);
    const coreBase = env.coreApiBaseUrl();

    // Query core API discovery
    const res = await fetch(`${coreBase}/v1/pm2/discovery`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      return NextResponse.json({
        runtime: "pm2",
        connected: false,
        processName: targetProcess,
        processFound: false,
        process: null,
        processes: [],
        error: `Core API returned HTTP ${res.status}`,
      });
    }

    const data = (await res.json()) as {
      connected: boolean;
      processes: Array<{
        name: string;
        status: string;
        pid?: number;
        uptime?: number;
        cpu?: number;
        memory?: number;
        restarts?: number;
        cwd?: string;
      }>;
    };

    const matches = targetProcess ? data.processes.filter((p) => p.name.toLowerCase() === targetProcess.toLowerCase()) : [];
    const process = data.processes.find((p) => p.name === targetProcess)
      ?? (new Set(matches.map((p) => p.name)).size === 1 ? matches[0] : null)
      ?? null;

    return NextResponse.json({
      runtime: "pm2",
      connected: data.connected,
      processName: process?.name ?? targetProcess,
      processFound: Boolean(process),
      process,
      processes: data.processes,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      runtime: "pm2",
      connected: false,
      processName: targetProcess,
      processFound: false,
      process: null,
      processes: [],
      error: err instanceof Error ? err.message : "Failed to connect to CARF Core API",
    });
  }
}
