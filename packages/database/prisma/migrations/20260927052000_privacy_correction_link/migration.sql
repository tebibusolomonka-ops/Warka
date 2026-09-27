ALTER TABLE "PrivacyRequest" ADD COLUMN "officialCorrectionRequestId" TEXT;
CREATE INDEX "PrivacyRequest_officialCorrectionRequestId_idx" ON "PrivacyRequest"("officialCorrectionRequestId");
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_officialCorrectionRequestId_fkey" FOREIGN KEY ("officialCorrectionRequestId") REFERENCES "StudentCorrectionRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
