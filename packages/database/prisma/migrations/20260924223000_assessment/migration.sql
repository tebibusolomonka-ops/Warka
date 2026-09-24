CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "gradingPeriodId" TEXT NOT NULL,
    "schoolClassId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maximumScore" DECIMAL(8,2) NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Assessment_schoolId_academicYearId_gradingPeriodId_schoolCl_idx" ON "Assessment"("schoolId", "academicYearId", "gradingPeriodId", "schoolClassId", "subjectId");

CREATE UNIQUE INDEX "Assessment_context_name_key" ON "Assessment"("schoolId", "academicYearId", "gradingPeriodId", "schoolClassId", "subjectId", "name");

CREATE UNIQUE INDEX "Assessment_context_position_key" ON "Assessment"("schoolId", "academicYearId", "gradingPeriodId", "schoolClassId", "subjectId", "position");

ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_academicYearId_schoolId_fkey" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_gradingPeriodId_schoolId_academicYearId_fkey" FOREIGN KEY ("gradingPeriodId", "schoolId", "academicYearId") REFERENCES "GradingPeriod"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_schoolClassId_schoolId_academicYearId_fkey" FOREIGN KEY ("schoolClassId", "schoolId", "academicYearId") REFERENCES "SchoolClass"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_subjectId_schoolId_fkey" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "Subject"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
