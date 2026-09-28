CREATE TYPE "MakeUpAssessmentStatus" AS ENUM ('requested', 'approved', 'scheduled', 'completed', 'rejected', 'cancelled');

CREATE TABLE "MakeUpAssessment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "originalSessionId" TEXT NOT NULL,
    "originalParticipationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "MakeUpAssessmentStatus" NOT NULL DEFAULT 'requested',
    "scheduledDate" DATE,
    "startTime" VARCHAR(5),
    "endTime" VARCHAR(5),
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MakeUpAssessment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MakeUpAssessment_time_check" CHECK (("startTime" IS NULL AND "endTime" IS NULL) OR ("startTime" IS NOT NULL AND "endTime" IS NOT NULL AND "startTime" < "endTime"))
);

CREATE UNIQUE INDEX "MakeUpAssessment_originalParticipationId_key" ON "MakeUpAssessment"("originalParticipationId");
CREATE INDEX "MakeUpAssessment_schoolId_status_idx" ON "MakeUpAssessment"("schoolId", "status");
ALTER TABLE "MakeUpAssessment" ADD CONSTRAINT "MakeUpAssessment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MakeUpAssessment" ADD CONSTRAINT "MakeUpAssessment_originalSessionId_schoolId_fkey" FOREIGN KEY ("originalSessionId", "schoolId") REFERENCES "AssessmentSession"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MakeUpAssessment" ADD CONSTRAINT "MakeUpAssessment_originalParticipationId_fkey" FOREIGN KEY ("originalParticipationId") REFERENCES "AssessmentParticipation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MakeUpAssessment" ADD CONSTRAINT "MakeUpAssessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MakeUpAssessment" ADD CONSTRAINT "MakeUpAssessment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MakeUpAssessment" ADD CONSTRAINT "MakeUpAssessment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
