CREATE TYPE "VerificationResultStatus" AS ENUM ('active', 'corrected', 'withdrawn', 'unavailable');
CREATE TABLE "VerificationEvent" (
    "id" TEXT NOT NULL,
    "issuedDocumentId" TEXT,
    "schoolId" TEXT,
    "resultStatus" "VerificationResultStatus" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VerificationEvent_schoolId_occurredAt_resultStatus_idx" ON "VerificationEvent"("schoolId", "occurredAt", "resultStatus");
ALTER TABLE "VerificationEvent" ADD CONSTRAINT "VerificationEvent_issuedDocumentId_fkey" FOREIGN KEY ("issuedDocumentId") REFERENCES "IssuedDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerificationEvent" ADD CONSTRAINT "VerificationEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;