-- CreateTable
CREATE TABLE "AssignmentExtension" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "originalDueAt" TIMESTAMP(3) NOT NULL,
    "extendedDueAt" TIMESTAMP(3) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignmentExtension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssignmentExtension_assignmentId_studentId_createdAt_idx" ON "AssignmentExtension"("assignmentId", "studentId", "createdAt");

-- CreateIndex
CREATE INDEX "AssignmentExtension_schoolId_createdAt_idx" ON "AssignmentExtension"("schoolId", "createdAt");

-- AddForeignKey
ALTER TABLE "AssignmentExtension" ADD CONSTRAINT "AssignmentExtension_assignmentId_schoolId_fkey" FOREIGN KEY ("assignmentId", "schoolId") REFERENCES "CourseworkAssignment"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentExtension" ADD CONSTRAINT "AssignmentExtension_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentExtension" ADD CONSTRAINT "AssignmentExtension_enrollmentId_schoolId_studentId_fkey" FOREIGN KEY ("enrollmentId", "schoolId", "studentId") REFERENCES "Enrollment"("id", "schoolId", "studentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentExtension" ADD CONSTRAINT "AssignmentExtension_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
