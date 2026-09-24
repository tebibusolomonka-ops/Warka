CREATE TABLE "Mark" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "score" DECIMAL(8,2) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mark_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Mark_schoolId_assessmentId_idx" ON "Mark"("schoolId", "assessmentId");

CREATE INDEX "Mark_schoolId_studentId_idx" ON "Mark"("schoolId", "studentId");

CREATE UNIQUE INDEX "Mark_enrollmentId_assessmentId_key" ON "Mark"("enrollmentId", "assessmentId");

CREATE UNIQUE INDEX "Enrollment_id_schoolId_studentId_key" ON "Enrollment"("id", "schoolId", "studentId");

CREATE UNIQUE INDEX "Assessment_id_schoolId_key" ON "Assessment"("id", "schoolId");

ALTER TABLE "Mark" ADD CONSTRAINT "Mark_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Mark" ADD CONSTRAINT "Mark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Mark" ADD CONSTRAINT "Mark_enrollmentId_schoolId_studentId_fkey" FOREIGN KEY ("enrollmentId", "schoolId", "studentId") REFERENCES "Enrollment"("id", "schoolId", "studentId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Mark" ADD CONSTRAINT "Mark_assessmentId_schoolId_fkey" FOREIGN KEY ("assessmentId", "schoolId") REFERENCES "Assessment"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Mark" ADD CONSTRAINT "Mark_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
