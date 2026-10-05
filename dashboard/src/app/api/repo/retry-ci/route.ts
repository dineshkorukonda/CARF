import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { mintInstallationToken } from "../../../../lib/installationAccess";
import { invalidateRepoCi } from "../../../../lib/repoCi";
import { retryCiRuns } from "../../../../lib/retryCi";
import { prisma } from "../../../../lib/prisma";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(process.env.DASHBOARD_BASE_URL || request.url).origin) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { installationId, owner, repo, runIds } = body ?? {};
  if (typeof installationId !== "string" || typeof owner !== "string" || typeof repo !== "string" ||
    !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo) ||
    !Array.isArray(runIds) || runIds.length < 1 || runIds.length > 10 ||
    runIds.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(runIds).size !== runIds.length) {
    return NextResponse.json({ error: "Select between 1 and 10 distinct CI runs." }, { status: 400 });
  }
  if (!await getInstallationForAccount(prisma, session.user.id, installationId)) {
    return NextResponse.json({ error: "Installation not authorized" }, { status: 403 });
  }
  try {
    const integration = await prisma.repoIntegration.findFirst({ where: { installationId, owner, repo }, select: { branch: true } });
    const branch = integration?.branch || "main";
    const token = await mintInstallationToken(installationId);
    const results = await retryCiRuns({ owner, repo, branch, runIds, token });
    invalidateRepoCi(installationId, owner, repo, branch);
    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not reach GitHub. Check Actions before trying again." }, { status: 502 });
  }
}
