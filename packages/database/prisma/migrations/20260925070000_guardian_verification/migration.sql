CREATE TYPE "GuardianVerificationStatus" AS ENUM ('pending', 'verified', 'revoked');

ALTER TABLE "StudentGuardian" ADD COLUMN     "revocationReason" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedById" TEXT,
ADD COLUMN     "verificationSchoolId" TEXT,
ADD COLUMN     "verificationStatus" "GuardianVerificationStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

CREATE INDEX "StudentGuardian_verificationSchoolId_verificationStatus_idx" ON "StudentGuardian"("verificationSchoolId", "verificationStatus");

ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_verificationSchoolId_fkey" FOREIGN KEY ("verificationSchoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
