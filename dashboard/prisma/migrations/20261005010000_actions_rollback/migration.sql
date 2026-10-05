ALTER TABLE "RolloutOutcome" ADD COLUMN "rollbackExecutor" TEXT NOT NULL DEFAULT 'server',
ADD COLUMN "rollbackRequestedAt" TIMESTAMP(3),
ADD COLUMN "rollbackStartedAt" TIMESTAMP(3);
