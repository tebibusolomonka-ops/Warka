ALTER TYPE "PrivacyRestrictionState" ADD VALUE 'reviewRequired';
CREATE TABLE "ProcessingRestriction" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "privacyRequestId" TEXT NOT NULL,
  "category" "PrivacyRestrictionCategory" NOT NULL,
  "status" "PrivacyRestrictionState" NOT NULL,
  "effectiveAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "approvedById" TEXT NOT NULL,
  "endedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcessingRestriction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProcessingRestriction_privacyRequestId_category_key" ON "ProcessingRestriction"("privacyRequestId", "category");
CREATE INDEX "ProcessingRestriction_schoolId_studentId_category_status_idx" ON "ProcessingRestriction"("schoolId", "studentId", "category", "status");
ALTER TABLE "ProcessingRestriction" ADD CONSTRAINT "ProcessingRestriction_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessingRestriction" ADD CONSTRAINT "ProcessingRestriction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessingRestriction" ADD CONSTRAINT "ProcessingRestriction_privacyRequestId_fkey" FOREIGN KEY ("privacyRequestId") REFERENCES "PrivacyRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessingRestriction" ADD CONSTRAINT "ProcessingRestriction_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcessingRestriction" ADD CONSTRAINT "ProcessingRestriction_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
