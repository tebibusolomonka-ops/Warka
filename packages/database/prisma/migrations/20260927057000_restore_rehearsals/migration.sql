CREATE TYPE "RestoreRehearsalStatus" AS ENUM ('running', 'succeeded', 'failed');
CREATE TABLE "RestoreRehearsal" (
  "id" TEXT NOT NULL,
  "backupId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "status" "RestoreRehearsalStatus" NOT NULL DEFAULT 'running',
  "failureReason" TEXT,
  "performedById" TEXT NOT NULL,
  CONSTRAINT "RestoreRehearsal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RestoreRehearsal_backupId_startedAt_idx" ON "RestoreRehearsal"("backupId", "startedAt");
CREATE INDEX "RestoreRehearsal_status_startedAt_idx" ON "RestoreRehearsal"("status", "startedAt");
ALTER TABLE "RestoreRehearsal" ADD CONSTRAINT "RestoreRehearsal_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES "BackupRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RestoreRehearsal" ADD CONSTRAINT "RestoreRehearsal_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
