CREATE TABLE "EnrollmentCorrectionRequest" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "previousGradeLevelId" TEXT NOT NULL,
  "previousSchoolClassId" TEXT,
  "proposedGradeLevelId" TEXT NOT NULL,
  "proposedSchoolClassId" TEXT,
  "reason" TEXT NOT NULL,
  "status" "CorrectionRequestStatus" NOT NULL DEFAULT 'pending',
  "requestedById" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  CONSTRAINT "EnrollmentCorrectionRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EnrollmentCorrectionRequest_schoolId_status_requestedAt_idx" ON "EnrollmentCorrectionRequest"("schoolId", "status", "requestedAt");
CREATE INDEX "EnrollmentCorrectionRequest_enrollmentId_requestedAt_idx" ON "EnrollmentCorrectionRequest"("enrollmentId", "requestedAt");
CREATE UNIQUE INDEX "EnrollmentCorrectionRequest_pending_enrollment_key" ON "EnrollmentCorrectionRequest"("enrollmentId") WHERE "status" = 'pending';
ALTER TABLE "EnrollmentCorrectionRequest" ADD CONSTRAINT "EnrollmentCorrectionRequest_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentCorrectionRequest" ADD CONSTRAINT "EnrollmentCorrectionRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentCorrectionRequest" ADD CONSTRAINT "EnrollmentCorrectionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentCorrectionRequest" ADD CONSTRAINT "EnrollmentCorrectionRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
