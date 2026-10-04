import { prisma } from "./prisma";
import type { RepoConnection, Prisma } from "@prisma/client";

/**
 * Maps a raw SQL row (where some columns may be null or undefined due to older schema versions)
 * into a typed, schema-complete RepoConnection object with sensible defaults.
 */
export function mapRawRepoConnection(row: Record<string, unknown>): RepoConnection {
  const isSahaay = String(row.repo || "").toLowerCase() === "sahaay";
  const storedCfg =
    row.storedConfig && typeof row.storedConfig === "object"
      ? (row.storedConfig as Record<string, unknown>)
      : {};

  const defaultAdapter =
    row.mode === "standalone" || isSahaay || storedCfg.target || storedCfg.kind === "pm2"
      ? "pm2"
      : "none";

  const defaultProcess =
    (storedCfg.target as string) ||
    (storedCfg.name as string) ||
    (storedCfg.targetName as string) ||
    (isSahaay ? "sahaay" : null);

  return {
    id: String(row.id ?? `conn-${row.owner}-${row.repo}`),
    installationId: String(row.installationId ?? ""),
    owner: String(row.owner ?? ""),
    repo: String(row.repo ?? ""),
    mode: (row.mode as RepoConnection["mode"]) ?? "standalone",
    deploymentIntegration: (row.deploymentIntegration as string) ?? "github_actions",
    runtimeAdapter: (row.runtimeAdapter as string) ?? defaultAdapter,
    pm2Process: (row.pm2Process as string) ?? defaultProcess,
    verifiedAt: row.verifiedAt instanceof Date ? row.verifiedAt : row.verifiedAt ? new Date(String(row.verifiedAt)) : null,
    verificationReport: (row.verificationReport as Prisma.JsonValue) ?? null,
    monitoringPaused: Boolean(row.monitoringPaused),
    storedConfig: (row.storedConfig as Prisma.JsonValue) ?? null,
    installTokenHash: (row.installTokenHash as string) ?? null,
    installTokenPrefix: (row.installTokenPrefix as string) ?? null,
    agentLastHeartbeat: row.agentLastHeartbeat instanceof Date ? row.agentLastHeartbeat : row.agentLastHeartbeat ? new Date(String(row.agentLastHeartbeat)) : null,
    agentVersion: (row.agentVersion as string) ?? null,
    agentRevoked: (row.agentRevoked as boolean) ?? false,
    createdAt: row.createdAt instanceof Date ? row.createdAt : row.createdAt ? new Date(String(row.createdAt)) : new Date(),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : row.updatedAt ? new Date(String(row.updatedAt)) : new Date(),
  };
}

let autoRepairAttempted = false;

/**
 * Attempts an idempotent schema repair on the database if columns or types are missing.
 * Runs non-destructive ALTER TABLE ... ADD COLUMN IF NOT EXISTS statements.
 */
export async function attemptAutoRepairSchema(): Promise<void> {
  if (autoRepairAttempted) return;
  autoRepairAttempted = true;

  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
          CREATE TYPE "RolloutStatus" AS ENUM ('PENDING', 'SUCCESS', 'ROLLED_BACK', 'FAILED');
      EXCEPTION
          WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
          CREATE TYPE "RolloutTrigger" AS ENUM ('auto', 'manual');
      EXCEPTION
          WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
          CREATE TYPE "DeploymentMode" AS ENUM ('standalone', 'augment');
      EXCEPTION
          WHEN duplicate_object THEN NULL;
      END $$;

      ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "mode" "DeploymentMode" DEFAULT 'standalone';
      ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "deploymentIntegration" TEXT DEFAULT 'github_actions';
      ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "runtimeAdapter" TEXT DEFAULT 'none';
      ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "pm2Process" TEXT;
      ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "installTokenHash" TEXT;
      ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "installTokenPrefix" TEXT;
      ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "agentLastHeartbeat" TIMESTAMP(3);
      ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "agentVersion" TEXT;
      ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "agentRevoked" BOOLEAN NOT NULL DEFAULT false;

      ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "owner" TEXT;
      ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "repo" TEXT;
      ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "commitSha" TEXT NOT NULL DEFAULT '';
      ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "status" "RolloutStatus" NOT NULL DEFAULT 'PENDING';
      ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "trigger" "RolloutTrigger" NOT NULL DEFAULT 'auto';
      ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "readyAt" TIMESTAMP(3);
      ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "threshold" DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "window" INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3);
      ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "finalErrorRate" DOUBLE PRECISION;
      ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "reason" TEXT;
      ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "rollbackVerified" BOOLEAN;
      ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    `);
    console.log("[repoConnectionService] Successfully applied idempotent schema auto-repair");
  } catch (err) {
    console.warn("[repoConnectionService] Auto-repair DDL encountered error (continuing with query fallbacks):", err);
  }
}

/**
 * Safely fetches all RepoConnection records for the specified installation IDs.
 * If Prisma throws due to unapplied migrations (P2021 / P2022), attempts schema repair
 * and falls back to a raw SELECT * query so that user projects NEVER disappear.
 */
export async function listRepoConnectionsSafe(installationIds: string[]): Promise<RepoConnection[]> {
  if (!installationIds || installationIds.length === 0) return [];

  try {
    return await prisma.repoConnection.findMany({
      where: {
        installationId: { in: installationIds },
      },
    });
  } catch (err: unknown) {
    console.warn("[repoConnectionService] findMany failed, attempting repair and raw fallback:", err);
    await attemptAutoRepairSchema();

    try {
      const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM "RepoConnection" WHERE "installationId" = ANY($1::text[])`,
        installationIds,
      );
      if (Array.isArray(rows)) {
        return rows.map(mapRawRepoConnection);
      }
    } catch (fallbackErr) {
      console.error("[repoConnectionService] raw query fallback failed:", fallbackErr);
    }
    return [];
  }
}

/**
 * Safely fetches a single RepoConnection record matching owner and repo.
 */
export async function findRepoConnectionSafe(
  installationIds: string[],
  owner: string,
  repo: string,
): Promise<RepoConnection | null> {
  if (!installationIds || installationIds.length === 0) return null;

  try {
    return await prisma.repoConnection.findFirst({
      where: {
        installationId: { in: installationIds },
        owner: { equals: owner, mode: "insensitive" },
        repo: { equals: repo, mode: "insensitive" },
      },
    });
  } catch (err: unknown) {
    console.warn("[repoConnectionService] findFirst failed, attempting repair and raw fallback:", err);
    await attemptAutoRepairSchema();

    try {
      const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM "RepoConnection" WHERE "installationId" = ANY($1::text[]) AND lower("owner") = lower($2) AND lower("repo") = lower($3) LIMIT 1`,
        installationIds,
        owner,
        repo,
      );
      if (Array.isArray(rows) && rows.length > 0) {
        return mapRawRepoConnection(rows[0]!);
      }
    } catch (fallbackErr) {
      console.error("[repoConnectionService] raw query fallback failed:", fallbackErr);
    }
    return null;
  }
}

/**
 * Safely fetches a single RepoConnection by its unique ID.
 */
export async function findRepoConnectionByIdSafe(id: string): Promise<RepoConnection | null> {
  if (!id) return null;

  try {
    return await prisma.repoConnection.findUnique({
      where: { id },
    });
  } catch (err: unknown) {
    console.warn("[repoConnectionService] findUnique failed, attempting repair and raw fallback:", err);
    await attemptAutoRepairSchema();

    try {
      const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM "RepoConnection" WHERE "id" = $1 LIMIT 1`,
        id,
      );
      if (Array.isArray(rows) && rows.length > 0) {
        return mapRawRepoConnection(rows[0]!);
      }
    } catch (fallbackErr) {
      console.error("[repoConnectionService] raw query fallback failed:", fallbackErr);
    }
    return null;
  }
}
