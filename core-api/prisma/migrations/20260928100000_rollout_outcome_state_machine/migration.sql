-- CreateEnum
CREATE TYPE "RolloutStatus" AS ENUM ('PENDING', 'SUCCESS', 'ROLLED_BACK', 'FAILED');

-- AlterTable
ALTER TABLE "RolloutOutcome" 
    ALTER COLUMN "commitId" DROP NOT NULL,
    ADD COLUMN "owner" TEXT,
    ADD COLUMN "repo" TEXT,
    ADD COLUMN "commitSha" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "status" "RolloutStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "threshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN "window" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "finishedAt" TIMESTAMP(3),
    ALTER COLUMN "finalErrorRate" DROP NOT NULL,
    ALTER COLUMN "rolledBack" SET DEFAULT false,
    ADD COLUMN "reason" TEXT,
    ADD COLUMN "rollbackVerified" BOOLEAN,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "RolloutOutcome_installationId_commitSha_key" ON "RolloutOutcome"("installationId", "commitSha");

-- CreateIndex
CREATE INDEX "RolloutOutcome_status_idx" ON "RolloutOutcome"("status");
