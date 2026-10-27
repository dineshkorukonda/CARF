-- Prisma supplies these required values. Align canonical migrations with the
-- client schema instead of retaining historical defaults that hide missing data.
ALTER TABLE "Account" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Installation" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "RiskProfile" ALTER COLUMN "flags" DROP DEFAULT;
ALTER TABLE "RolloutOutcome" ALTER COLUMN "commitSha" DROP DEFAULT,
  ALTER COLUMN "threshold" DROP DEFAULT, ALTER COLUMN "window" DROP DEFAULT;
ALTER TABLE "Session" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;
