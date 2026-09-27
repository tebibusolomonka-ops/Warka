CREATE TYPE "BackupVerificationResult" AS ENUM ('passed', 'failed');
ALTER TABLE "BackupRecord" ADD COLUMN "verifiedAt" TIMESTAMP(3), ADD COLUMN "verificationResult" "BackupVerificationResult", ADD COLUMN "verificationReason" TEXT;
