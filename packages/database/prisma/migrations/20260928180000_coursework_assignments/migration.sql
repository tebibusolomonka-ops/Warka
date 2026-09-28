-- CreateEnum
CREATE TYPE "CourseworkAssignmentStatus" AS ENUM ('draft', 'published', 'closed', 'cancelled');

-- CreateTable
CREATE TABLE "CourseworkAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "gradingPeriodId" TEXT,
    "schoolClassId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teachingAssignmentId" TEXT NOT NULL,
    "assessmentId" TEXT,
    "createdById" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "instructions" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "CourseworkAssignmentStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseworkAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseworkAssignment_schoolId_academicYearId_schoolClassId__idx" ON "CourseworkAssignment"("schoolId", "academicYearId", "schoolClassId", "subjectId", "status");

-- CreateIndex
CREATE INDEX "CourseworkAssignment_teachingAssignmentId_status_idx" ON "CourseworkAssignment"("teachingAssignmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CourseworkAssignment_id_schoolId_key" ON "CourseworkAssignment"("id", "schoolId");

-- AddForeignKey
ALTER TABLE "CourseworkAssignment" ADD CONSTRAINT "CourseworkAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseworkAssignment" ADD CONSTRAINT "CourseworkAssignment_academicYearId_schoolId_fkey" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseworkAssignment" ADD CONSTRAINT "CourseworkAssignment_gradingPeriodId_schoolId_academicYear_fkey" FOREIGN KEY ("gradingPeriodId", "schoolId", "academicYearId") REFERENCES "GradingPeriod"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseworkAssignment" ADD CONSTRAINT "CourseworkAssignment_schoolClassId_schoolId_academicYearId_fkey" FOREIGN KEY ("schoolClassId", "schoolId", "academicYearId") REFERENCES "SchoolClass"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseworkAssignment" ADD CONSTRAINT "CourseworkAssignment_subjectId_schoolId_fkey" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "Subject"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseworkAssignment" ADD CONSTRAINT "CourseworkAssignment_teachingAssignmentId_schoolId_academi_fkey" FOREIGN KEY ("teachingAssignmentId", "schoolId", "academicYearId", "schoolClassId", "subjectId") REFERENCES "TeachingAssignment"("id", "schoolId", "academicYearId", "schoolClassId", "subjectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseworkAssignment" ADD CONSTRAINT "CourseworkAssignment_assessmentId_schoolId_fkey" FOREIGN KEY ("assessmentId", "schoolId") REFERENCES "Assessment"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseworkAssignment" ADD CONSTRAINT "CourseworkAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
