-- CreateTable
CREATE TABLE "Commit" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "baseSha" TEXT NOT NULL,
    "installationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeVector" (
    "id" TEXT NOT NULL,
    "commitId" TEXT NOT NULL,
    "infra" DOUBLE PRECISION NOT NULL,
    "dependency" DOUBLE PRECISION NOT NULL,
    "config" DOUBLE PRECISION NOT NULL,
    "code" DOUBLE PRECISION NOT NULL,
    "codeComplexity" DOUBLE PRECISION NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeVector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Threshold" (
    "id" TEXT NOT NULL,
    "commitId" TEXT NOT NULL,
    "finalThreshold" DOUBLE PRECISION NOT NULL,
    "finalWindow" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Threshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationLog" (
    "id" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "mttrMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Commit_owner_repo_idx" ON "Commit"("owner", "repo");

-- CreateIndex
CREATE UNIQUE INDEX "Commit_owner_repo_sha_key" ON "Commit"("owner", "repo", "sha");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeVector_commitId_key" ON "ChangeVector"("commitId");

-- CreateIndex
CREATE UNIQUE INDEX "Threshold_commitId_key" ON "Threshold"("commitId");

-- CreateIndex
CREATE INDEX "EvaluationLog_commitSha_idx" ON "EvaluationLog"("commitSha");

-- CreateIndex
CREATE INDEX "EvaluationLog_condition_idx" ON "EvaluationLog"("condition");

-- AddForeignKey
ALTER TABLE "ChangeVector" ADD CONSTRAINT "ChangeVector_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "Commit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Threshold" ADD CONSTRAINT "Threshold_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "Commit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
