-- AlterTable
ALTER TABLE "ChangeVector" ADD COLUMN "data" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Commit_installationId_idx" ON "Commit"("installationId");

-- CreateIndex
CREATE INDEX "Commit_installationId_createdAt_idx" ON "Commit"("installationId", "createdAt");
