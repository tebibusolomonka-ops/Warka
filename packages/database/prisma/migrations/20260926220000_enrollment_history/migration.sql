CREATE TYPE "EnrollmentHistoryType" AS ENUM ('enrolled', 'submitted', 'approved', 'classChanged', 'gradeChanged', 'promoted', 'withdrawn', 'reEnrolled');
CREATE TABLE "EnrollmentHistoryEvent" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "eventType" "EnrollmentHistoryType" NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "performedById" TEXT,
    "reason" TEXT,
    "previousAcademicYearId" TEXT,
    "previousGradeLevelId" TEXT,
    "previousSchoolClassId" TEXT,
    "newAcademicYearId" TEXT,
    "newGradeLevelId" TEXT,
    "newSchoolClassId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnrollmentHistoryEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EnrollmentHistoryEvent_enrollmentId_effectiveAt_idx" ON "EnrollmentHistoryEvent"("enrollmentId", "effectiveAt");
CREATE INDEX "EnrollmentHistoryEvent_performedById_idx" ON "EnrollmentHistoryEvent"("performedById");
ALTER TABLE "EnrollmentHistoryEvent" ADD CONSTRAINT "EnrollmentHistoryEvent_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnrollmentHistoryEvent" ADD CONSTRAINT "EnrollmentHistoryEvent_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
