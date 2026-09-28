CREATE TYPE "AssessmentScheduleStatus" AS ENUM ('draft', 'scheduled', 'completed', 'cancelled');

CREATE TABLE "AssessmentSchedule" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "gradingPeriodId" TEXT NOT NULL,
    "schoolClassId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "roomId" TEXT,
    "scheduledDate" DATE NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,
    "status" "AssessmentScheduleStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssessmentSchedule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AssessmentSchedule_time_check" CHECK ("startTime" < "endTime")
);

CREATE UNIQUE INDEX "AssessmentSchedule_id_schoolId_key" ON "AssessmentSchedule"("id", "schoolId");
CREATE INDEX "AssessmentSchedule_schoolId_scheduledDate_startTime_idx" ON "AssessmentSchedule"("schoolId", "scheduledDate", "startTime");
CREATE INDEX "AssessmentSchedule_assessmentId_status_idx" ON "AssessmentSchedule"("assessmentId", "status");
ALTER TABLE "AssessmentSchedule" ADD CONSTRAINT "AssessmentSchedule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentSchedule" ADD CONSTRAINT "AssessmentSchedule_academicYearId_schoolId_fkey" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentSchedule" ADD CONSTRAINT "AssessmentSchedule_gradingPeriodId_schoolId_academicYearId_fkey" FOREIGN KEY ("gradingPeriodId", "schoolId", "academicYearId") REFERENCES "GradingPeriod"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentSchedule" ADD CONSTRAINT "AssessmentSchedule_schoolClassId_schoolId_academicYearId_fkey" FOREIGN KEY ("schoolClassId", "schoolId", "academicYearId") REFERENCES "SchoolClass"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentSchedule" ADD CONSTRAINT "AssessmentSchedule_subjectId_schoolId_fkey" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "Subject"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentSchedule" ADD CONSTRAINT "AssessmentSchedule_assessmentId_schoolId_fkey" FOREIGN KEY ("assessmentId", "schoolId") REFERENCES "Assessment"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentSchedule" ADD CONSTRAINT "AssessmentSchedule_roomId_schoolId_fkey" FOREIGN KEY ("roomId", "schoolId") REFERENCES "AssessmentRoom"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
