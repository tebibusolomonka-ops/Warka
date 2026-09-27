CREATE TYPE "BackupScope" AS ENUM ('database');
CREATE TYPE "BackupStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'verified');

CREATE TABLE "BackupRecord" (
  "id" TEXT NOT NULL,
  "scope" "BackupScope" NOT NULL DEFAULT 'database',
  "status" "BackupStatus" NOT NULL DEFAULT 'pending',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  "sizeBytes" BIGINT,
  "checksum" TEXT,
  "storageReference" TEXT,
  "failureReason" TEXT,
  CONSTRAINT "BackupRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BackupRecord_createdAt_idx" ON "BackupRecord"("createdAt");
CREATE INDEX "BackupRecord_status_createdAt_idx" ON "BackupRecord"("status", "createdAt");
ALTER TABLE "BackupRecord" ADD CONSTRAINT "BackupRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
