-- AlterTable Threshold
ALTER TABLE "Threshold" ADD COLUMN IF NOT EXISTS "baseThreshold" DOUBLE PRECISION;
ALTER TABLE "Threshold" ADD COLUMN IF NOT EXISTS "baseWindow" INTEGER;

-- AlterTable RepoConnection
ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "installTokenHash" TEXT;
ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "installTokenPrefix" TEXT;
ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "agentLastHeartbeat" TIMESTAMP(3);
ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "agentVersion" TEXT;
ALTER TABLE "RepoConnection" ADD COLUMN IF NOT EXISTS "agentRevoked" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RepoConnection_installTokenHash_idx" ON "RepoConnection"("installTokenHash");

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

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RiskProfile_commitId_key" ON "RiskProfile"("commitId");

-- AddForeignKey
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

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Commit_installationId_createdAt_idx" ON "Commit"("installationId", "createdAt");
