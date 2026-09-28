/**
 * Persists and updates rollout outcomes during standalone rollback monitoring.
 * Tracks state transitions: PENDING -> SUCCESS | ROLLED_BACK | FAILED.
 */

export type RolloutStatus = "PENDING" | "SUCCESS" | "ROLLED_BACK" | "FAILED";

export interface RolloutOutcomeRecord {
  id: string;
  commitId?: string | null;
  owner?: string | null;
  repo?: string | null;
  commitSha: string;
  installationId?: string | null;
  status: RolloutStatus;
  threshold: number;
  window: number;
  startedAt: Date;
  finishedAt?: Date | null;
  finalErrorRate?: number | null;
  rolledBack: boolean;
  reason?: string | null;
  rollbackVerified?: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RolloutSampleRecord {
  id: string;
  rolloutId: string;
  ts: Date;
  errorRate: number;
  perTarget?: unknown;
}

/** Minimal seam over the subset of PrismaClient's API this module needs. */
export interface RolloutOutcomePrismaClient {
  rolloutOutcome: {
    findMany(args?: {
      where?: { status?: RolloutStatus; owner?: string; repo?: string };
      orderBy?: { startedAt?: "asc" | "desc" };
    }): Promise<RolloutOutcomeRecord[]>;
    findUnique?(args: {
      where: { id?: string; installationId_commitSha?: { installationId: string; commitSha: string } };
    }): Promise<RolloutOutcomeRecord | null>;
    upsert(args: {
      where: { installationId_commitSha: { installationId: string; commitSha: string } };
      create: {
        commit?: { connect: { owner_repo_sha: { owner: string; repo: string; sha: string } } };
        owner?: string;
        repo?: string;
        commitSha: string;
        installationId?: string;
        status: RolloutStatus;
        threshold: number;
        window: number;
        startedAt?: Date;
        rolledBack?: boolean;
      };
      update: {
        threshold?: number;
        window?: number;
      };
    }): Promise<RolloutOutcomeRecord>;
    update(args: {
      where: { id: string };
      data: {
        status?: RolloutStatus;
        finishedAt?: Date;
        finalErrorRate?: number;
        rolledBack?: boolean;
        reason?: string;
        rollbackVerified?: boolean | null;
      };
    }): Promise<RolloutOutcomeRecord>;
  };
  rolloutSample?: {
    create(args: {
      data: {
        rolloutId: string;
        ts?: Date;
        errorRate: number;
        perTarget?: unknown;
      };
    }): Promise<RolloutSampleRecord>;
    findMany(args: {
      where: { rolloutId: string };
      orderBy: { ts: "asc" | "desc" };
    }): Promise<RolloutSampleRecord[]>;
    deleteMany(args: {
      where: { ts: { lt: Date } };
    }): Promise<{ count: number }>;
  };
}

export interface CreatePendingOutcomeParams {
  owner: string;
  repo: string;
  commitSha: string;
  installationId?: string;
  threshold: number;
  window: number;
}

export interface FinalizeOutcomeParams {
  id: string;
  status: RolloutStatus;
  finalErrorRate?: number;
  rolledBack: boolean;
  reason?: string;
  rollbackVerified?: boolean | null;
  finishedAt?: Date;
}

export async function createPendingRolloutOutcome(
  prisma: RolloutOutcomePrismaClient,
  params: CreatePendingOutcomeParams
): Promise<RolloutOutcomeRecord> {
  const installationKey = params.installationId ?? "";
  return await prisma.rolloutOutcome.upsert({
    where: {
      installationId_commitSha: {
        installationId: installationKey,
        commitSha: params.commitSha,
      },
    },
    create: {
      commit: {
        connect: {
          owner_repo_sha: {
            owner: params.owner,
            repo: params.repo,
            sha: params.commitSha,
          },
        },
      },
      owner: params.owner,
      repo: params.repo,
      commitSha: params.commitSha,
      ...(params.installationId !== undefined ? { installationId: params.installationId } : {}),
      status: "PENDING",
      threshold: params.threshold,
      window: params.window,
      startedAt: new Date(),
      rolledBack: false,
    },
    update: {
      threshold: params.threshold,
      window: params.window,
    },
  });
}

export async function finalizeRolloutOutcome(
  prisma: RolloutOutcomePrismaClient,
  params: FinalizeOutcomeParams
): Promise<RolloutOutcomeRecord> {
  return await prisma.rolloutOutcome.update({
    where: { id: params.id },
    data: {
      status: params.status,
      finishedAt: params.finishedAt ?? new Date(),
      ...(params.finalErrorRate !== undefined ? { finalErrorRate: params.finalErrorRate } : {}),
      rolledBack: params.rolledBack,
      ...(params.reason !== undefined ? { reason: params.reason } : {}),
      ...(params.rollbackVerified !== undefined ? { rollbackVerified: params.rollbackVerified } : {}),
    },
  });
}

export async function getPendingRolloutOutcomes(
  prisma: RolloutOutcomePrismaClient
): Promise<RolloutOutcomeRecord[]> {
  return await prisma.rolloutOutcome.findMany({
    where: { status: "PENDING" },
    orderBy: { startedAt: "asc" },
  });
}

export async function recordRolloutSample(
  prisma: RolloutOutcomePrismaClient,
  rolloutId: string,
  errorRate: number,
  perTarget?: unknown,
  ts?: Date
): Promise<RolloutSampleRecord | null> {
  if (!prisma.rolloutSample?.create) return null;
  return await prisma.rolloutSample.create({
    data: {
      rolloutId,
      errorRate,
      perTarget,
      ...(ts ? { ts } : {}),
    },
  });
}

export async function getRolloutSamples(
  prisma: RolloutOutcomePrismaClient,
  rolloutId: string
): Promise<RolloutSampleRecord[]> {
  if (!prisma.rolloutSample?.findMany) return [];
  return await prisma.rolloutSample.findMany({
    where: { rolloutId },
    orderBy: { ts: "asc" },
  });
}

export async function pruneRolloutSamples(
  prisma: RolloutOutcomePrismaClient,
  retentionDays: number = 30
): Promise<number> {
  if (!prisma.rolloutSample?.deleteMany) return 0;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await prisma.rolloutSample.deleteMany({
    where: { ts: { lt: cutoff } },
  });
  return result.count;
}

