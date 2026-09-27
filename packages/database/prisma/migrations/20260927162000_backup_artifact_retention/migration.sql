ALTER TYPE "BackupStatus" ADD VALUE 'deleting';
ALTER TYPE "BackupStatus" ADD VALUE 'deleted';
ALTER TABLE "BackupRecord" ADD COLUMN "deletedAt" TIMESTAMP(3);
