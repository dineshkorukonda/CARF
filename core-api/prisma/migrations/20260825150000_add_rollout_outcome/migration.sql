-- CreateTable
CREATE TABLE "RolloutOutcome" (
    "id" TEXT NOT NULL,
    "commitId" TEXT NOT NULL,
    "installationId" TEXT,
    "rolledBack" BOOLEAN NOT NULL,
    "finalErrorRate" DOUBLE PRECISION NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolloutOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RolloutOutcome_commitId_idx" ON "RolloutOutcome"("commitId");

-- CreateIndex
CREATE INDEX "RolloutOutcome_installationId_idx" ON "RolloutOutcome"("installationId");

-- AddForeignKey
ALTER TABLE "RolloutOutcome" ADD CONSTRAINT "RolloutOutcome_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "Commit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
