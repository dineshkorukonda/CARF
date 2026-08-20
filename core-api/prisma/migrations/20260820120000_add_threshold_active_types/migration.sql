-- AlterTable
ALTER TABLE "Threshold" ADD COLUMN "activeTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
