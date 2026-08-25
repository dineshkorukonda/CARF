-- CreateTable
CREATE TABLE "StandaloneLoopLock" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandaloneLoopLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StandaloneLoopLock_owner_repo_sha_key" ON "StandaloneLoopLock"("owner", "repo", "sha");
