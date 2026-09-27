CREATE TYPE "PrivacyRequestType" AS ENUM ('access', 'correction', 'restriction', 'objection');
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('submitted', 'underReview', 'approved', 'rejected', 'fulfilled', 'cancelled');
CREATE TYPE "PrivacyRequesterKind" AS ENUM ('student', 'guardian');
CREATE TYPE "PrivacyRestrictionCategory" AS ENUM ('parentPortalSharing', 'publicDocumentVerification');
CREATE TYPE "PrivacyRestrictionState" AS ENUM ('active', 'ended');
CREATE TABLE "PrivacyRequest" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "requesterKind" "PrivacyRequesterKind" NOT NULL,
  "type" "PrivacyRequestType" NOT NULL,
  "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'submitted',
  "details" TEXT NOT NULL,
  "correctionField" "StudentCorrectionField",
  "correctionValue" TEXT,
  "restrictionCategory" "PrivacyRestrictionCategory",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "reviewReason" TEXT,
  "fulfilledAt" TIMESTAMP(3),
  CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PrivacyRequest_schoolId_status_createdAt_idx" ON "PrivacyRequest"("schoolId", "status", "createdAt");
CREATE INDEX "PrivacyRequest_requesterUserId_createdAt_idx" ON "PrivacyRequest"("requesterUserId", "createdAt");
CREATE INDEX "PrivacyRequest_studentId_createdAt_idx" ON "PrivacyRequest"("studentId", "createdAt");
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
