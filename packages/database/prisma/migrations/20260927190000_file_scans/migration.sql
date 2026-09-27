CREATE TYPE "FileScanStatus" AS ENUM ('pending', 'scanning', 'clean', 'infected', 'failed', 'unavailable');
CREATE TYPE "FileScanResult" AS ENUM ('clean', 'infected');
ALTER TABLE "FileAsset" ADD COLUMN "scanRequired" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "FileScan" (
  "id" TEXT NOT NULL,
  "fileAssetId" TEXT NOT NULL,
  "scanner" TEXT NOT NULL,
  "status" "FileScanStatus" NOT NULL DEFAULT 'pending',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "result" "FileScanResult",
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FileScan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FileScan_fileAssetId_createdAt_idx" ON "FileScan"("fileAssetId", "createdAt");
CREATE INDEX "FileScan_status_createdAt_idx" ON "FileScan"("status", "createdAt");
ALTER TABLE "FileScan" ADD CONSTRAINT "FileScan_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
