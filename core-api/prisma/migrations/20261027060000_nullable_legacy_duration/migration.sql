-- Preserve historical report durations while allowing current rollout writers
-- to omit this legacy column. New verdicts are persisted in HealthReport.
ALTER TABLE "RolloutOutcome" ADD COLUMN IF NOT EXISTS "durationMs" INTEGER;
ALTER TABLE "RolloutOutcome" ALTER COLUMN "durationMs" DROP NOT NULL;
