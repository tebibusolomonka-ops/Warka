CREATE TYPE "BackupFrequency" AS ENUM ('daily', 'weekly');
CREATE TABLE "BackupPolicy" (
  "id" TEXT NOT NULL DEFAULT 'database',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "frequency" "BackupFrequency" NOT NULL DEFAULT 'daily',
  "retentionCount" INTEGER NOT NULL DEFAULT 7,
  "verificationRequired" BOOLEAN NOT NULL DEFAULT true,
  "updatedById" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BackupPolicy_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "BackupPolicy" ADD CONSTRAINT "BackupPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
