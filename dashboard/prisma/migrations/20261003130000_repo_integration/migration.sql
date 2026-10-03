-- Additive: per-repository integration state (GitHub Actions auto-integration for Augment mode).
-- Creates a new table only. No existing rows, tables, or columns are modified or removed.
-- Identical to dashboard/prisma/migrations/20261003130000_repo_integration.
-- core-api owns `prisma migrate deploy` against the shared database.

CREATE TABLE "RepoIntegration" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "integration" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_configured',
    "branch" TEXT,
    "workflowPath" TEXT,
    "workflowVersion" INTEGER,
    "configuredAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastPolicyAt" TIMESTAMP(3),
    "lastCommitSha" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepoIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RepoIntegration_installationId_owner_repo_integration_key" ON "RepoIntegration"("installationId", "owner", "repo", "integration");
CREATE INDEX "RepoIntegration_installationId_idx" ON "RepoIntegration"("installationId");