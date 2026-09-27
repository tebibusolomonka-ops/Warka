CREATE TYPE "RetentionHoldScope" AS ENUM ('student', 'privacyRequest', 'issuedDocument');
CREATE TABLE "RetentionHold" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "scope" "RetentionHoldScope" NOT NULL,
  "studentId" TEXT,
  "privacyRequestId" TEXT,
  "issuedDocumentId" TEXT,
  "reason" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedById" TEXT,
  "releasedAt" TIMESTAMP(3),
  CONSTRAINT "RetentionHold_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RetentionHold_organizationId_scope_releasedAt_idx" ON "RetentionHold"("organizationId", "scope", "releasedAt");
CREATE INDEX "RetentionHold_studentId_releasedAt_idx" ON "RetentionHold"("studentId", "releasedAt");
CREATE INDEX "RetentionHold_issuedDocumentId_releasedAt_idx" ON "RetentionHold"("issuedDocumentId", "releasedAt");
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_privacyRequestId_fkey" FOREIGN KEY ("privacyRequestId") REFERENCES "PrivacyRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_issuedDocumentId_fkey" FOREIGN KEY ("issuedDocumentId") REFERENCES "IssuedDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RetentionHold" ADD CONSTRAINT "RetentionHold_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
