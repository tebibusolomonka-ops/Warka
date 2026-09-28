CREATE TYPE "TimetableStatus" AS ENUM ('draft', 'published', 'archived');

CREATE TABLE "ClassTimetable" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolClassId" TEXT NOT NULL,
  "status" "TimetableStatus" NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "ClassTimetable_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClassTimetable_scope_key" ON "ClassTimetable"("id", "schoolId", "academicYearId", "schoolClassId");
CREATE INDEX "ClassTimetable_schoolId_academicYearId_schoolClassId_status_idx" ON "ClassTimetable"("schoolId", "academicYearId", "schoolClassId", "status");
CREATE UNIQUE INDEX "ClassTimetable_one_draft_key" ON "ClassTimetable"("schoolClassId", "academicYearId") WHERE "status" = 'draft';
CREATE UNIQUE INDEX "ClassTimetable_one_published_key" ON "ClassTimetable"("schoolClassId", "academicYearId") WHERE "status" = 'published';
ALTER TABLE "ClassTimetable" ADD CONSTRAINT "ClassTimetable_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassTimetable" ADD CONSTRAINT "ClassTimetable_academicYearId_schoolId_fkey" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassTimetable" ADD CONSTRAINT "ClassTimetable_schoolClassId_schoolId_academicYearId_fkey" FOREIGN KEY ("schoolClassId", "schoolId", "academicYearId") REFERENCES "SchoolClass"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClassTimetableEntry" ADD COLUMN "timetableId" TEXT;
INSERT INTO "ClassTimetable" ("id", "schoolId", "academicYearId", "schoolClassId", "status")
SELECT gen_random_uuid()::text, "schoolId", "academicYearId", "schoolClassId", 'draft'::"TimetableStatus"
FROM "ClassTimetableEntry"
GROUP BY "schoolId", "academicYearId", "schoolClassId";
UPDATE "ClassTimetableEntry" AS entry
SET "timetableId" = plan."id"
FROM "ClassTimetable" AS plan
WHERE entry."schoolId" = plan."schoolId"
  AND entry."academicYearId" = plan."academicYearId"
  AND entry."schoolClassId" = plan."schoolClassId";
ALTER TABLE "ClassTimetableEntry" ALTER COLUMN "timetableId" SET NOT NULL;
DROP INDEX "ClassTimetableEntry_class_slot_key";
CREATE UNIQUE INDEX "ClassTimetableEntry_plan_slot_key" ON "ClassTimetableEntry"("timetableId", "weekday", "timetablePeriodId");
ALTER TABLE "ClassTimetableEntry" ADD CONSTRAINT "ClassTimetableEntry_timetable_scope_fkey" FOREIGN KEY ("timetableId", "schoolId", "academicYearId", "schoolClassId") REFERENCES "ClassTimetable"("id", "schoolId", "academicYearId", "schoolClassId") ON DELETE RESTRICT ON UPDATE CASCADE;
