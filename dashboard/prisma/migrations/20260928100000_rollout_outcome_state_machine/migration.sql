-- Create missing Core-API tables mirrored in dashboard schema if they don't already exist

CREATE TABLE IF NOT EXISTS "Commit" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "baseSha" TEXT NOT NULL,
    "installationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Commit_owner_repo_sha_key" ON "Commit"("owner", "repo", "sha");
CREATE INDEX IF NOT EXISTS "Commit_owner_repo_idx" ON "Commit"("owner", "repo");
CREATE INDEX IF NOT EXISTS "Commit_installationId_idx" ON "Commit"("installationId");
CREATE INDEX IF NOT EXISTS "Commit_installationId_createdAt_idx" ON "Commit"("installationId", "createdAt");

CREATE TABLE IF NOT EXISTS "ChangeVector" (
    "id" TEXT NOT NULL,
    "commitId" TEXT NOT NULL,
    "infra" DOUBLE PRECISION NOT NULL,
    "dependency" DOUBLE PRECISION NOT NULL,
    "config" DOUBLE PRECISION NOT NULL,
    "code" DOUBLE PRECISION NOT NULL,
    "data" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "codeComplexity" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeVector_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChangeVector_commitId_key" ON "ChangeVector"("commitId");

DO $$ BEGIN
    ALTER TABLE "ChangeVector" ADD CONSTRAINT "ChangeVector_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "Commit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "Threshold" (
    "id" TEXT NOT NULL,
    "commitId" TEXT NOT NULL,
    "finalThreshold" DOUBLE PRECISION NOT NULL,
    "finalWindow" INTEGER NOT NULL,
    "activeTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Threshold_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Threshold_commitId_key" ON "Threshold"("commitId");

DO $$ BEGIN
    ALTER TABLE "Threshold" ADD CONSTRAINT "Threshold_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "Commit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "StandaloneLoopLock" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandaloneLoopLock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StandaloneLoopLock_owner_repo_sha_key" ON "StandaloneLoopLock"("owner", "repo", "sha");

DO $$ BEGIN
    CREATE TYPE "RolloutStatus" AS ENUM ('PENDING', 'SUCCESS', 'ROLLED_BACK', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "RolloutOutcome" (
    "id" TEXT NOT NULL,
    "commitId" TEXT,
    "owner" TEXT,
    "repo" TEXT,
    "commitSha" TEXT NOT NULL DEFAULT '',
    "installationId" TEXT,
    "status" "RolloutStatus" NOT NULL DEFAULT 'PENDING',
    "threshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "window" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "finalErrorRate" DOUBLE PRECISION,
    "rolledBack" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "rollbackVerified" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolloutOutcome_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RolloutOutcome_installationId_commitSha_key" ON "RolloutOutcome"("installationId", "commitSha");
CREATE INDEX IF NOT EXISTS "RolloutOutcome_commitId_idx" ON "RolloutOutcome"("commitId");
CREATE INDEX IF NOT EXISTS "RolloutOutcome_installationId_idx" ON "RolloutOutcome"("installationId");
CREATE INDEX IF NOT EXISTS "RolloutOutcome_status_idx" ON "RolloutOutcome"("status");

DO $$ BEGIN
    ALTER TABLE "RolloutOutcome" ADD CONSTRAINT "RolloutOutcome_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "Commit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "InstallationApiKey" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstallationApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InstallationApiKey_installationId_key" ON "InstallationApiKey"("installationId");
CREATE UNIQUE INDEX IF NOT EXISTS "InstallationApiKey_keyHash_key" ON "InstallationApiKey"("keyHash");

CREATE TABLE IF NOT EXISTS "EvaluationLog" (
    "id" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "mttrMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EvaluationLog_commitSha_idx" ON "EvaluationLog"("commitSha");
CREATE INDEX IF NOT EXISTS "EvaluationLog_condition_idx" ON "EvaluationLog"("condition");
