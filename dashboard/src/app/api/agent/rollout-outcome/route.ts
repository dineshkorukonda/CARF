import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { authenticateAgentRequest } from "../auth";
import type { Prisma, RolloutStatus } from "@prisma/client";

interface RolloutSampleInput {
  ts?: string | Date;
  errorRate?: number;
  perTarget?: Prisma.InputJsonValue;
}

interface RolloutOutcomeRequestBody {
  commitSha?: string;
  status?: RolloutStatus;
  startedAt?: string | Date;
  finishedAt?: string | Date;
  threshold?: number;
  window?: number;
  finalErrorRate?: number | null;
  rolledBack?: boolean;
  reason?: string | null;
  rollbackVerified?: boolean | null;
  trigger?: string;
  readyAt?: string | Date;
  samples?: RolloutSampleInput[];
}

export async function POST(req: NextRequest) {
  const authResult = await authenticateAgentRequest(req);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { connection } = authResult;
  let body: RolloutOutcomeRequestBody;
  try {
    body = (await req.json()) as RolloutOutcomeRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { commitSha, status } = body;
  if (!commitSha || typeof commitSha !== "string") {
    return NextResponse.json({ error: "commitSha is required" }, { status: 400 });
  }

  const validStatuses: RolloutStatus[] = ["PENDING", "SUCCESS", "ROLLED_BACK", "FAILED"];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status: ${status}. Must be one of ${validStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  // Look for existing commit row if any
  const commit = await prisma.commit.findFirst({
    where: {
      sha: commitSha,
      installationId: connection.installationId,
      owner: connection.owner,
      repo: connection.repo,
    },
    select: { id: true },
  });

  const now = new Date();
  const startedAt = body.startedAt ? new Date(body.startedAt) : now;
  const finishedAt = body.finishedAt ? new Date(body.finishedAt) : undefined;
  const threshold = typeof body.threshold === "number" ? body.threshold : 0;
  const window = typeof body.window === "number" ? body.window : 0;
  const finalErrorRate = typeof body.finalErrorRate === "number" ? body.finalErrorRate : null;
  const rolledBack = Boolean(body.rolledBack);
  const reason = typeof body.reason === "string" ? body.reason : null;
  const rollbackVerified = typeof body.rollbackVerified === "boolean" ? body.rollbackVerified : null;
  const trigger = body.trigger === "manual" ? "manual" : "auto";
  const readyAt = body.readyAt ? new Date(body.readyAt) : undefined;

  // Upsert the RolloutOutcome record scoped by installationId and commitSha
  const outcome = await prisma.rolloutOutcome.upsert({
    where: {
      installationId_owner_repo_commitSha: {
        installationId: connection.installationId,
        owner: connection.owner,
        repo: connection.repo,
        commitSha,
      },
    },
    create: {
      installationId: connection.installationId,
      commitSha,
      commitId: commit?.id ?? null,
      owner: connection.owner,
      repo: connection.repo,
      status,
      trigger,
      readyAt,
      threshold,
      window,
      startedAt,
      finishedAt,
      finalErrorRate,
      rolledBack,
      reason,
      rollbackVerified,
    },
    update: {
      status,
      trigger,
      readyAt,
      threshold,
      window,
      finishedAt,
      finalErrorRate,
      rolledBack,
      reason,
      rollbackVerified,
      ...(commit?.id ? { commitId: commit.id } : {}),
    },
  });

  // If samples are provided in the payload, append them
  if (Array.isArray(body.samples) && body.samples.length > 0) {
    const sampleRows = body.samples
      .filter((s): s is RolloutSampleInput & { errorRate: number } => typeof s?.errorRate === "number")
      .map((s) => ({
        rolloutId: outcome.id,
        ts: s.ts ? new Date(s.ts) : new Date(),
        errorRate: Number(s.errorRate),
        perTarget: s.perTarget ?? undefined,
      }));

    if (sampleRows.length > 0) {
      await prisma.rolloutSample.createMany({
        data: sampleRows,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    rolloutId: outcome.id,
    status: outcome.status,
  });
}
