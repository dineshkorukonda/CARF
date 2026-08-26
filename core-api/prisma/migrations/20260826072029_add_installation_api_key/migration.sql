-- CreateTable
CREATE TABLE "InstallationApiKey" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstallationApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstallationApiKey_installationId_key" ON "InstallationApiKey"("installationId");

-- CreateIndex
CREATE UNIQUE INDEX "InstallationApiKey_keyHash_key" ON "InstallationApiKey"("keyHash");
