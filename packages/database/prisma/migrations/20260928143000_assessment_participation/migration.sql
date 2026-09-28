CREATE TYPE "AssessmentParticipationStatus" AS ENUM ('present', 'absent', 'excused');

CREATE TABLE "AssessmentParticipation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "schoolClassId" TEXT NOT NULL,
    "status" "AssessmentParticipationStatus" NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssessmentParticipation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssessmentParticipation_sessionId_studentId_key" ON "AssessmentParticipation"("sessionId", "studentId");
CREATE INDEX "AssessmentParticipation_schoolId_studentId_idx" ON "AssessmentParticipation"("schoolId", "studentId");
ALTER TABLE "AssessmentParticipation" ADD CONSTRAINT "AssessmentParticipation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentParticipation" ADD CONSTRAINT "AssessmentParticipation_sessionId_schoolId_fkey" FOREIGN KEY ("sessionId", "schoolId") REFERENCES "AssessmentSession"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentParticipation" ADD CONSTRAINT "AssessmentParticipation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentParticipation" ADD CONSTRAINT "AssessmentParticipation_enrollmentId_schoolId_academicYearId_schoolClassId_studentId_fkey" FOREIGN KEY ("enrollmentId", "schoolId", "academicYearId", "schoolClassId", "studentId") REFERENCES "Enrollment"("id", "schoolId", "academicYearId", "schoolClassId", "studentId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentParticipation" ADD CONSTRAINT "AssessmentParticipation_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
