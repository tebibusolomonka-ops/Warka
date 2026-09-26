CREATE TYPE "ProgressionPlanStatus" AS ENUM ('draft', 'reviewed', 'applied', 'cancelled');
CREATE TYPE "ProgressionAction" AS ENUM ('promote', 'repeat', 'withdraw', 'manualReview');
CREATE TABLE "ProgressionPlan" (
    "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "sourceAcademicYearId" TEXT NOT NULL, "targetAcademicYearId" TEXT NOT NULL, "createdById" TEXT NOT NULL,
    "status" "ProgressionPlanStatus" NOT NULL DEFAULT 'draft', "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3), "appliedById" TEXT, "appliedAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProgressionPlan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProgressionPlan_schoolId_sourceAcademicYearId_status_idx" ON "ProgressionPlan"("schoolId", "sourceAcademicYearId", "status");
CREATE INDEX "ProgressionPlan_schoolId_targetAcademicYearId_idx" ON "ProgressionPlan"("schoolId", "targetAcademicYearId");
CREATE UNIQUE INDEX "ProgressionPlan_active_pair_key" ON "ProgressionPlan"("schoolId", "sourceAcademicYearId", "targetAcademicYearId") WHERE "status" IN ('draft', 'reviewed');
ALTER TABLE "ProgressionPlan" ADD CONSTRAINT "ProgressionPlan_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgressionPlan" ADD CONSTRAINT "ProgressionPlan_sourceAcademicYearId_schoolId_fkey" FOREIGN KEY ("sourceAcademicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgressionPlan" ADD CONSTRAINT "ProgressionPlan_targetAcademicYearId_schoolId_fkey" FOREIGN KEY ("targetAcademicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgressionPlan" ADD CONSTRAINT "ProgressionPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgressionPlan" ADD CONSTRAINT "ProgressionPlan_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgressionPlan" ADD CONSTRAINT "ProgressionPlan_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "ProgressionEntry" (
    "id" TEXT NOT NULL, "planId" TEXT NOT NULL, "studentId" TEXT NOT NULL, "sourceEnrollmentId" TEXT NOT NULL,
    "action" "ProgressionAction" NOT NULL DEFAULT 'manualReview', "targetGradeLevelId" TEXT, "targetSchoolClassId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProgressionEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProgressionEntry_planId_studentId_key" ON "ProgressionEntry"("planId", "studentId");
CREATE INDEX "ProgressionEntry_sourceEnrollmentId_idx" ON "ProgressionEntry"("sourceEnrollmentId");
ALTER TABLE "ProgressionEntry" ADD CONSTRAINT "ProgressionEntry_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProgressionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressionEntry" ADD CONSTRAINT "ProgressionEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgressionEntry" ADD CONSTRAINT "ProgressionEntry_sourceEnrollmentId_fkey" FOREIGN KEY ("sourceEnrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
