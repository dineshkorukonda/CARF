CREATE TABLE "HealthReport" (
  "id" TEXT NOT NULL,
  "commitId" TEXT NOT NULL,
  "installationId" TEXT,
  "errorRate" DOUBLE PRECISION NOT NULL,
  "action" TEXT NOT NULL,
  "durationMs" DOUBLE PRECISION,
  "threshold" DOUBLE PRECISION NOT NULL,
  "window" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HealthReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HealthReport_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "Commit"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "HealthReport_commitId_createdAt_idx" ON "HealthReport"("commitId", "createdAt");
CREATE INDEX "HealthReport_installationId_createdAt_idx" ON "HealthReport"("installationId", "createdAt");
