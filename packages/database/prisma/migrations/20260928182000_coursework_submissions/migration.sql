-- CreateEnum
CREATE TYPE "CourseworkSubmissionStatus" AS ENUM ('draft', 'submitted', 'withdrawn');

-- CreateTable
CREATE TABLE "CourseworkSubmission" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "status" "CourseworkSubmissionStatus" NOT NULL DEFAULT 'draft',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseworkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseworkSubmission_schoolId_assignmentId_status_idx" ON "CourseworkSubmission"("schoolId", "assignmentId", "status");

-- CreateIndex
CREATE INDEX "CourseworkSubmission_studentId_status_idx" ON "CourseworkSubmission"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CourseworkSubmission_assignmentId_studentId_key" ON "CourseworkSubmission"("assignmentId", "studentId");

-- AddForeignKey
ALTER TABLE "CourseworkSubmission" ADD CONSTRAINT "CourseworkSubmission_assignmentId_schoolId_fkey" FOREIGN KEY ("assignmentId", "schoolId") REFERENCES "CourseworkAssignment"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseworkSubmission" ADD CONSTRAINT "CourseworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseworkSubmission" ADD CONSTRAINT "CourseworkSubmission_enrollmentId_schoolId_studentId_fkey" FOREIGN KEY ("enrollmentId", "schoolId", "studentId") REFERENCES "Enrollment"("id", "schoolId", "studentId") ON DELETE RESTRICT ON UPDATE CASCADE;
