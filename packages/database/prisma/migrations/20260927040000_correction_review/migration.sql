ALTER TABLE "StudentCorrectionRequest" ADD COLUMN "reviewReason" TEXT;
ALTER TABLE "StudentCorrectionRequest" ADD COLUMN "effectiveAt" TIMESTAMP(3);
ALTER TABLE "EnrollmentCorrectionRequest" ADD COLUMN "reviewReason" TEXT;
ALTER TABLE "EnrollmentCorrectionRequest" ADD COLUMN "effectiveAt" TIMESTAMP(3);
