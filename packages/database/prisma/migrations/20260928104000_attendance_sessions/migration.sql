CREATE TYPE "AttendanceSessionStatus" AS ENUM ('open', 'submitted', 'finalized', 'cancelled');

CREATE TABLE "AttendanceSession" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolClassId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "timetablePeriodId" TEXT,
  "subjectId" TEXT,
  "teachingAssignmentId" TEXT,
  "status" "AttendanceSessionStatus" NOT NULL DEFAULT 'open',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "finalizedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceSession_mode_check" CHECK (
    ("timetablePeriodId" IS NULL AND "subjectId" IS NULL AND "teachingAssignmentId" IS NULL) OR
    ("timetablePeriodId" IS NOT NULL AND "subjectId" IS NOT NULL AND "teachingAssignmentId" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "AttendanceSession_daily_key" ON "AttendanceSession"("schoolClassId", "date") WHERE "timetablePeriodId" IS NULL;
CREATE UNIQUE INDEX "AttendanceSession_period_key" ON "AttendanceSession"("schoolClassId", "date", "timetablePeriodId") WHERE "timetablePeriodId" IS NOT NULL;
CREATE INDEX "AttendanceSession_schoolId_academicYearId_schoolClassId_date_idx" ON "AttendanceSession"("schoolId", "academicYearId", "schoolClassId", "date");
CREATE INDEX "AttendanceSession_teachingAssignmentId_date_idx" ON "AttendanceSession"("teachingAssignmentId", "date");
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_academicYearId_schoolId_fkey" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_schoolClassId_schoolId_academicYearId_fkey" FOREIGN KEY ("schoolClassId", "schoolId", "academicYearId") REFERENCES "SchoolClass"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_timetablePeriodId_schoolId_fkey" FOREIGN KEY ("timetablePeriodId", "schoolId") REFERENCES "TimetablePeriod"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_subjectId_schoolId_fkey" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "Subject"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_assignment_scope_fkey" FOREIGN KEY ("teachingAssignmentId", "schoolId", "academicYearId", "schoolClassId", "subjectId") REFERENCES "TeachingAssignment"("id", "schoolId", "academicYearId", "schoolClassId", "subjectId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
