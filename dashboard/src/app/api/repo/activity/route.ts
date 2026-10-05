import { NextRequest, NextResponse } from "next/server";
import { getCurrentAccount } from "../../../../lib/auth";
import { getInstallationForAccount } from "../../../../lib/accountService";
import { commitActivitySelect, rolloutActivitySelect } from "../../../../lib/repoActivitySelect";
import { getRepoCi } from "../../../../lib/repoCi";
import { prisma } from "../../../../lib/prisma";

export async function GET(request: NextRequest) {
  const started = performance.now();
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const installationId = params.get("installationId");
  const owner = params.get("owner");
  const repo = params.get("repo");
  if (!installationId || !owner || !repo) return NextResponse.json({ error: "installationId, owner and repo are required" }, { status: 400 });
  if (!await getInstallationForAccount(prisma, account.id, installationId)) {
    return NextResponse.json({ error: "Installation not authorized" }, { status: 403 });
  }
  const where = { installationId, owner: { equals: owner, mode: "insensitive" as const }, repo: { equals: repo, mode: "insensitive" as const } };
  try {
    const sampleId = params.get("samplesFor");
    const [rollouts, commits, samples, integration] = await Promise.all([
      prisma.rolloutOutcome.findMany({ where, select: rolloutActivitySelect, orderBy: { startedAt: "desc" }, take: 50 }),
      prisma.commit.findMany({ where, select: commitActivitySelect, orderBy: { createdAt: "desc" }, take: 50 }),
      sampleId ? prisma.rolloutSample.findMany({
        where: { rolloutId: sampleId, rollout: where }, select: { id: true, ts: true, errorRate: true },
        orderBy: { ts: "desc" }, take: 200,
      }) : Promise.resolve([]),
      prisma.repoIntegration.findFirst({ where: { installationId, owner, repo }, select: { branch: true } }),
    ]);
    const dbDuration = performance.now() - started;
    const ci = await getRepoCi(installationId, owner, repo, integration?.branch || "main");
    return NextResponse.json({
      commits,
      ci,
      rollouts: rollouts.map((rollout) => rollout.id === sampleId ? { ...rollout, samples: samples.slice().reverse() } : rollout),
    }, { headers: { "Cache-Control": "private, no-store", "Server-Timing": `db;dur=${dbDuration.toFixed(1)}, activity;dur=${(performance.now() - started).toFixed(1)}` } });
  } catch {
    return NextResponse.json({ error: "Activity temporarily unavailable" }, { status: 503 });
  }
}
