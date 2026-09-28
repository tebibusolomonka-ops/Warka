CREATE TYPE "AssessmentSessionStatus" AS ENUM ('planned', 'open', 'completed', 'cancelled');

CREATE TABLE "AssessmentSession" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "schoolClassId" TEXT NOT NULL,
    "sessionDate" DATE NOT NULL,
    "startTime" VARCHAR(5) NOT NULL,
    "endTime" VARCHAR(5) NOT NULL,
    "status" "AssessmentSessionStatus" NOT NULL DEFAULT 'planned',
    "openedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssessmentSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssessmentSession_id_schoolId_key" ON "AssessmentSession"("id", "schoolId");
CREATE UNIQUE INDEX "AssessmentSession_scheduleId_key" ON "AssessmentSession"("scheduleId");
CREATE INDEX "AssessmentSession_schoolId_schoolClassId_sessionDate_idx" ON "AssessmentSession"("schoolId", "schoolClassId", "sessionDate");
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_scheduleId_schoolId_fkey" FOREIGN KEY ("scheduleId", "schoolId") REFERENCES "AssessmentSchedule"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentSession" ADD CONSTRAINT "AssessmentSession_schoolClassId_schoolId_fkey" FOREIGN KEY ("schoolClassId", "schoolId") REFERENCES "SchoolClass"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
