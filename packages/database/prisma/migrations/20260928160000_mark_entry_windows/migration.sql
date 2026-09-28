CREATE TYPE "MarkEntryWindowStatus" AS ENUM ('scheduled', 'open', 'closed');

CREATE TABLE "MarkEntryWindow" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "gradingPeriodId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "status" "MarkEntryWindowStatus" NOT NULL DEFAULT 'scheduled',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarkEntryWindow_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MarkEntryWindow_time_check" CHECK ("opensAt" < "closesAt")
);

CREATE UNIQUE INDEX "MarkEntryWindow_assessmentId_key" ON "MarkEntryWindow"("assessmentId");
CREATE UNIQUE INDEX "MarkEntryWindow_assessmentId_schoolId_key" ON "MarkEntryWindow"("assessmentId", "schoolId");
CREATE INDEX "MarkEntryWindow_schoolId_academicYearId_gradingPeriodId_idx" ON "MarkEntryWindow"("schoolId", "academicYearId", "gradingPeriodId");
ALTER TABLE "MarkEntryWindow" ADD CONSTRAINT "MarkEntryWindow_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarkEntryWindow" ADD CONSTRAINT "MarkEntryWindow_assessmentId_schoolId_fkey" FOREIGN KEY ("assessmentId", "schoolId") REFERENCES "Assessment"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarkEntryWindow" ADD CONSTRAINT "MarkEntryWindow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
