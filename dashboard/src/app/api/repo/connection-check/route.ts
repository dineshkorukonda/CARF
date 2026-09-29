import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { prisma } from "../../../../lib/prisma";
import { ensureCoreApiKey } from "../../../../lib/coreApiAccess";
import { env } from "../../../../config/env";
import { reconcileGitLayoutVerify, type VerifyResult, type VerifyTarget } from "../../../../lib/gitLayoutVerify";

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

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

  const { installationId, owner, repo, target } = (body || {}) as {
    installationId?: string;
    owner?: string;
    repo?: string;
    target?: VerifyTarget & { name?: string };
  };
  if (!installationId || !owner || !repo || !target || !target.name) {
    return NextResponse.json(
      { error: "Missing required fields: installationId, owner, repo, and target.name" },
      { status: 400 }
    );
  }

  const installation = await getInstallationForAccount(prisma, account.id, String(installationId));
  if (!installation) {
    return NextResponse.json({ error: "Installation not found or unauthorized" }, { status: 404 });
  }

  try {
    const apiKey = await ensureCoreApiKey(prisma, installation);
    const coreUrl = `${env.coreApiBaseUrl()}/v1/pm2/verify`;
    const res = await fetch(coreUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ owner, repo, target }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: `Core API verification failed (${res.status}): ${errText}` },
        { status: res.status }
      );
    }

    const data = (await res.json()) as VerifyResult;
    const reconciled = reconcileGitLayoutVerify(target, data);

    if (reconciled.verified) {
      try {
        const storedConfig = asJson(target);
        const verificationReport = asJson(reconciled.checks);
        await prisma.repoConnection.upsert({
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
            storedConfig,
            verifiedAt: new Date(),
            verificationReport,
          },
          update: {
            storedConfig,
            verifiedAt: new Date(),
            verificationReport,
          },
        });
      } catch (dbErr) {
        console.error("[api/repo/connection-check] Failed to persist RepoConnection:", dbErr);
      }
    }

    return NextResponse.json(reconciled);
  } catch (err: unknown) {
    console.error("[api/repo/connection-check] Error:", err);
    return NextResponse.json({ error: "Failed to connect to core API for verification" }, { status: 502 });
  }
}
