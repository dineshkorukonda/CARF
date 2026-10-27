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
ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "previousSha" TEXT;
ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "deployedAt" TIMESTAMP(3);
ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "deployedRevision" TEXT;
ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "durationMs" INTEGER;
ALTER TABLE "RolloutOutcome" ALTER COLUMN "durationMs" DROP NOT NULL;
ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "rollbackExecutor" TEXT NOT NULL DEFAULT 'server';
ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "rollbackRequestedAt" TIMESTAMP(3);
ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "rollbackStartedAt" TIMESTAMP(3);
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
    "installTokenHash" TEXT,
    "installTokenPrefix" TEXT,
    "agentLastHeartbeat" TIMESTAMP(3),
    "agentVersion" TEXT,
    "agentRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RepoConnection_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "installTokenHash" TEXT;
ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "installTokenPrefix" TEXT;
ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "agentLastHeartbeat" TIMESTAMP(3);
ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "agentVersion" TEXT;
ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "agentRevoked" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
    CREATE TYPE "DeploymentMode" AS ENUM ('standalone', 'augment');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "mode" "DeploymentMode" DEFAULT 'standalone';
ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "deploymentIntegration" TEXT DEFAULT 'github_actions';
ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "runtimeAdapter" TEXT DEFAULT 'none';
ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "pm2Process" TEXT;

-- Backfill runtimeAdapter for PM2/standalone repos (including Sahaay)
UPDATE "RepoConnection"
SET "runtimeAdapter" = 'pm2'
WHERE ("runtimeAdapter" = 'none' OR "runtimeAdapter" IS NULL)
  AND (
    "mode" = 'standalone'
    OR lower("repo") = 'sahaay'
    OR ("storedConfig"->>'mode') = 'standalone'
    OR NULLIF("storedConfig"->>'target', '') IS NOT NULL
    OR ("storedConfig"->>'kind') = 'pm2'
    OR "storedConfig"->'adapter' IS NOT NULL
    OR "installTokenHash" IS NOT NULL
  );

-- Backfill pm2Process for PM2 repos (including Sahaay)
UPDATE "RepoConnection"
SET "pm2Process" = COALESCE(
  "pm2Process",
  "storedConfig"->>'target',
  "storedConfig"->>'name',
  "storedConfig"->>'targetName',
  CASE WHEN lower("repo") = 'sahaay' THEN 'sahaay' ELSE NULL END
)
WHERE ("runtimeAdapter" = 'pm2' OR lower("repo") = 'sahaay' OR "storedConfig"->>'kind' = 'pm2');

-- Backfill deploymentIntegration based on storedConfig if specified
UPDATE "RepoConnection"
SET "deploymentIntegration" = 'argo_rollouts'
WHERE ("storedConfig"->>'integration') = 'argo-rollouts'
   OR ("storedConfig"->>'deploymentIntegration') = 'argo_rollouts';

UPDATE "RepoConnection"
SET "deploymentIntegration" = 'flagger'
WHERE ("storedConfig"->>'integration') = 'flagger'
   OR ("storedConfig"->>'deploymentIntegration') = 'flagger';

UPDATE "RepoConnection"
SET "deploymentIntegration" = 'generic_http'
WHERE ("storedConfig"->>'integration') = 'generic-http'
   OR ("storedConfig"->>'deploymentIntegration') = 'generic_http';


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

-- Threshold base threshold and window
ALTER TABLE "Threshold" ADD COLUMN IF NOT EXISTS "baseThreshold" DOUBLE PRECISION;
ALTER TABLE "Threshold" ADD COLUMN IF NOT EXISTS "baseWindow" INTEGER;

-- AlterTable Installation
ALTER TABLE "Installation" ALTER COLUMN "repositorySelection" DROP NOT NULL;

-- CreateTable RiskProfile
CREATE TABLE IF NOT EXISTS "RiskProfile" (
    "id" TEXT NOT NULL,
    "commitId" TEXT NOT NULL,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "multiplier" DOUBLE PRECISION NOT NULL,
    "calibratedCeiling" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "RiskProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RiskProfile_commitId_key" ON "RiskProfile"("commitId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'RiskProfile_commitId_fkey'
    ) THEN
        ALTER TABLE "RiskProfile" ADD CONSTRAINT "RiskProfile_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "Commit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- CreateTable EvalRun
CREATE TABLE IF NOT EXISTS "EvalRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iterations" INTEGER NOT NULL,
    "summary" JSONB NOT NULL,
    CONSTRAINT "EvalRun_pkey" PRIMARY KEY ("id")
);

-- Per-repository integration state (GitHub Actions, etc.)
CREATE TABLE IF NOT EXISTS "RepoIntegration" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "integration" TEXT NOT NULL DEFAULT 'github-actions',
    "status" TEXT NOT NULL DEFAULT 'not_configured',
    "branch" TEXT,
    "workflowPath" TEXT,
    "workflowVersion" INTEGER,
    "configuredAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastPolicyAt" TIMESTAMP(3),
    "lastCommitSha" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RepoIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RepoIntegration_installationId_owner_repo_integration_key" ON "RepoIntegration"("installationId", "owner", "repo", "integration");
CREATE INDEX IF NOT EXISTS "RepoIntegration_installationId_idx" ON "RepoIntegration"("installationId");
CREATE INDEX IF NOT EXISTS "RepoIntegration_owner_repo_idx" ON "RepoIntegration"("owner", "repo");

CREATE INDEX IF NOT EXISTS "Commit_installationId_createdAt_idx" ON "Commit"("installationId", "createdAt");

CREATE INDEX IF NOT EXISTS "RolloutOutcome_status_idx" ON "RolloutOutcome"("status");
DROP INDEX IF EXISTS "RolloutOutcome_installationId_commitSha_key";
CREATE UNIQUE INDEX IF NOT EXISTS "RolloutOutcome_installationId_owner_repo_commitSha_key" ON "RolloutOutcome"("installationId", "owner", "repo", "commitSha");
CREATE INDEX IF NOT EXISTS "RolloutSample_rolloutId_ts_idx" ON "RolloutSample"("rolloutId", "ts");
CREATE INDEX IF NOT EXISTS "RolloutSample_ts_idx" ON "RolloutSample"("ts");
CREATE INDEX IF NOT EXISTS "RepoConnection_installationId_idx" ON "RepoConnection"("installationId");
CREATE INDEX IF NOT EXISTS "RepoConnection_installTokenHash_idx" ON "RepoConnection"("installTokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "RepoConnection_installationId_owner_repo_key" ON "RepoConnection"("installationId", "owner", "repo");
CREATE INDEX IF NOT EXISTS "RolloutAuditLog_owner_repo_ts_idx" ON "RolloutAuditLog"("owner", "repo", "ts");
CREATE INDEX IF NOT EXISTS "RolloutAuditLog_rolloutId_idx" ON "RolloutAuditLog"("rolloutId");

DO $$ BEGIN
    ALTER TABLE "RolloutSample" ADD CONSTRAINT "RolloutSample_rolloutId_fkey"
        FOREIGN KEY ("rolloutId") REFERENCES "RolloutOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
