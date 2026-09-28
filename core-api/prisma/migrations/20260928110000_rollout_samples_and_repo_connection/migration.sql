-- CreateTable
CREATE TABLE "RolloutSample" (
    "id" TEXT NOT NULL,
    "rolloutId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorRate" DOUBLE PRECISION NOT NULL,
    "perTarget" JSONB,

    CONSTRAINT "RolloutSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepoConnection" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "verificationReport" JSONB,
    "monitoringPaused" BOOLEAN NOT NULL DEFAULT false,
    "storedConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepoConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolloutAuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "rolloutId" TEXT,
    "action" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "details" JSONB,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolloutAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RolloutSample_rolloutId_ts_idx" ON "RolloutSample"("rolloutId", "ts");

-- CreateIndex
CREATE INDEX "RolloutSample_ts_idx" ON "RolloutSample"("ts");

-- CreateIndex
CREATE INDEX "RepoConnection_installationId_idx" ON "RepoConnection"("installationId");

-- CreateIndex
CREATE UNIQUE INDEX "RepoConnection_installationId_owner_repo_key" ON "RepoConnection"("installationId", "owner", "repo");

-- CreateIndex
CREATE INDEX "RolloutAuditLog_owner_repo_ts_idx" ON "RolloutAuditLog"("owner", "repo", "ts");

-- CreateIndex
CREATE INDEX "RolloutAuditLog_rolloutId_idx" ON "RolloutAuditLog"("rolloutId");

-- AddForeignKey
ALTER TABLE "RolloutSample" ADD CONSTRAINT "RolloutSample_rolloutId_fkey" FOREIGN KEY ("rolloutId") REFERENCES "RolloutOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;
