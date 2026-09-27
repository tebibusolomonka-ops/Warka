ALTER TABLE "TeachingAssignment" ADD COLUMN "startsAt" TIMESTAMP(3);
UPDATE "TeachingAssignment" SET "startsAt" = "createdAt";
ALTER TABLE "TeachingAssignment" ALTER COLUMN "startsAt" SET NOT NULL;
ALTER TABLE "TeachingAssignment" ALTER COLUMN "startsAt" SET DEFAULT CURRENT_TIMESTAMP;
DROP INDEX "TeachingAssignment_userId_schoolClassId_subjectId_academicYearId_key";
CREATE UNIQUE INDEX "TeachingAssignment_current_slot_key"
  ON "TeachingAssignment"("userId", "schoolClassId", "subjectId", "academicYearId")
  WHERE "endsAt" IS NULL;
