CREATE TYPE "EnrollmentStatus" AS ENUM ('draft', 'pending', 'approved', 'withdrawn');

CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "gradeLevelId" TEXT NOT NULL,
    "schoolClassId" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'draft',
    "approvedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Enrollment_schoolId_academicYearId_status_idx" ON "Enrollment"("schoolId", "academicYearId", "status");

CREATE INDEX "Enrollment_schoolId_gradeLevelId_idx" ON "Enrollment"("schoolId", "gradeLevelId");

CREATE UNIQUE INDEX "Enrollment_studentId_schoolId_academicYearId_key" ON "Enrollment"("studentId", "schoolId", "academicYearId");

CREATE UNIQUE INDEX "SchoolClass_id_schoolId_key" ON "SchoolClass"("id", "schoolId");

ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_academicYearId_schoolId_fkey" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_gradeLevelId_schoolId_fkey" FOREIGN KEY ("gradeLevelId", "schoolId") REFERENCES "GradeLevel"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_schoolClassId_schoolId_fkey" FOREIGN KEY ("schoolClassId", "schoolId") REFERENCES "SchoolClass"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
