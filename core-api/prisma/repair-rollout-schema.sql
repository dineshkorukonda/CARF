-- Idempotent repair for a Neon DB that was created with `db push` / baselined
-- migrations. Safe to run more than once. Adds only what is missing.

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

-- Ensure columns that were NOT NULL in legacy migrations are nullable in the state machine schema
ALTER TABLE "RolloutOutcome" ALTER COLUMN "commitId" DROP NOT NULL;
ALTER TABLE "RolloutOutcome" ALTER COLUMN "finalErrorRate" DROP NOT NULL;

DO $$ BEGIN
    ALTER TABLE "RolloutOutcome" ALTER COLUMN "durationMs" DROP NOT NULL;
EXCEPTION
    WHEN undefined_column THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "RolloutSample" (
    "id" TEXT NOT NULL,
    "rolloutId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorRate" DOUBLE PRECISION NOT NULL,
    "perTarget" JSONB,
    CONSTRAINT "RolloutSample_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RepoConnection" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "verificationReport" JSONB,
    "monitoringPaused" BOOLEAN NOT NULL DEFAULT false,
    "storedConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RepoConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RolloutAuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "rolloutId" TEXT,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "details" JSONB,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RolloutAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RolloutOutcome_status_idx" ON "RolloutOutcome"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "RolloutOutcome_installationId_commitSha_key" ON "RolloutOutcome"("installationId", "commitSha");
CREATE INDEX IF NOT EXISTS "RolloutSample_rolloutId_ts_idx" ON "RolloutSample"("rolloutId", "ts");
CREATE INDEX IF NOT EXISTS "RolloutSample_ts_idx" ON "RolloutSample"("ts");
CREATE INDEX IF NOT EXISTS "RepoConnection_installationId_idx" ON "RepoConnection"("installationId");
CREATE UNIQUE INDEX IF NOT EXISTS "RepoConnection_installationId_owner_repo_key" ON "RepoConnection"("installationId", "owner", "repo");
CREATE INDEX IF NOT EXISTS "RolloutAuditLog_owner_repo_ts_idx" ON "RolloutAuditLog"("owner", "repo", "ts");
CREATE INDEX IF NOT EXISTS "RolloutAuditLog_rolloutId_idx" ON "RolloutAuditLog"("rolloutId");

DO $$ BEGIN
    ALTER TABLE "RolloutSample" ADD CONSTRAINT "RolloutSample_rolloutId_fkey"
        FOREIGN KEY ("rolloutId") REFERENCES "RolloutOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
