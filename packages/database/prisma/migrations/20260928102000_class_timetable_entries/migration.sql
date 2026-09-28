CREATE UNIQUE INDEX "TeachingAssignment_timetable_scope_key" ON "TeachingAssignment"("id", "schoolId", "academicYearId", "schoolClassId", "subjectId");

CREATE TABLE "ClassTimetableEntry" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolClassId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "teachingAssignmentId" TEXT NOT NULL,
  "timetablePeriodId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassTimetableEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClassTimetableEntry_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7)
);

CREATE UNIQUE INDEX "ClassTimetableEntry_class_slot_key" ON "ClassTimetableEntry"("schoolClassId", "academicYearId", "weekday", "timetablePeriodId");
CREATE INDEX "ClassTimetableEntry_schoolId_academicYearId_weekday_idx" ON "ClassTimetableEntry"("schoolId", "academicYearId", "weekday");
CREATE INDEX "ClassTimetableEntry_teachingAssignmentId_weekday_idx" ON "ClassTimetableEntry"("teachingAssignmentId", "weekday");
ALTER TABLE "ClassTimetableEntry" ADD CONSTRAINT "ClassTimetableEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassTimetableEntry" ADD CONSTRAINT "ClassTimetableEntry_academicYearId_schoolId_fkey" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassTimetableEntry" ADD CONSTRAINT "ClassTimetableEntry_schoolClassId_schoolId_academicYearId_fkey" FOREIGN KEY ("schoolClassId", "schoolId", "academicYearId") REFERENCES "SchoolClass"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassTimetableEntry" ADD CONSTRAINT "ClassTimetableEntry_subjectId_schoolId_fkey" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "Subject"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassTimetableEntry" ADD CONSTRAINT "ClassTimetableEntry_assignment_scope_fkey" FOREIGN KEY ("teachingAssignmentId", "schoolId", "academicYearId", "schoolClassId", "subjectId") REFERENCES "TeachingAssignment"("id", "schoolId", "academicYearId", "schoolClassId", "subjectId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassTimetableEntry" ADD CONSTRAINT "ClassTimetableEntry_timetablePeriodId_schoolId_fkey" FOREIGN KEY ("timetablePeriodId", "schoolId") REFERENCES "TimetablePeriod"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
