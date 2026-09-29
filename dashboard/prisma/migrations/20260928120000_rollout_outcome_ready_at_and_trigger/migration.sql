-- CreateEnum
CREATE TYPE "RolloutTrigger" AS ENUM ('auto', 'manual');

-- AlterTable
ALTER TABLE "RolloutOutcome" ADD COLUMN "trigger" "RolloutTrigger" NOT NULL DEFAULT 'auto';
ALTER TABLE "RolloutOutcome" ADD COLUMN "readyAt" TIMESTAMP(3);
