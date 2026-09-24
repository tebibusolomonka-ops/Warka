CREATE TABLE "TeachingAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "schoolClassId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeachingAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeachingAssignment_schoolId_academicYearId_userId_idx" ON "TeachingAssignment"("schoolId", "academicYearId", "userId");

CREATE INDEX "TeachingAssignment_schoolId_schoolClassId_subjectId_idx" ON "TeachingAssignment"("schoolId", "schoolClassId", "subjectId");

CREATE UNIQUE INDEX "TeachingAssignment_userId_schoolClassId_subjectId_academicY_key" ON "TeachingAssignment"("userId", "schoolClassId", "subjectId", "academicYearId");

CREATE UNIQUE INDEX "SchoolClass_id_schoolId_academicYearId_key" ON "SchoolClass"("id", "schoolId", "academicYearId");

ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_academicYearId_schoolId_fkey" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_schoolClassId_schoolId_academicYearId_fkey" FOREIGN KEY ("schoolClassId", "schoolId", "academicYearId") REFERENCES "SchoolClass"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_subjectId_schoolId_fkey" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "Subject"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
