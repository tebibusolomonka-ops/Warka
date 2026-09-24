CREATE TABLE "GradeLevel" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeLevel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SchoolClass" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "gradeLevelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolClass_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GradeLevel_schoolId_name_key" ON "GradeLevel"("schoolId", "name");

CREATE UNIQUE INDEX "GradeLevel_id_schoolId_key" ON "GradeLevel"("id", "schoolId");

CREATE INDEX "SchoolClass_schoolId_gradeLevelId_idx" ON "SchoolClass"("schoolId", "gradeLevelId");

CREATE UNIQUE INDEX "SchoolClass_schoolId_academicYearId_gradeLevelId_name_key" ON "SchoolClass"("schoolId", "academicYearId", "gradeLevelId", "name");

CREATE UNIQUE INDEX "AcademicYear_id_schoolId_key" ON "AcademicYear"("id", "schoolId");

ALTER TABLE "GradeLevel" ADD CONSTRAINT "GradeLevel_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_academicYearId_schoolId_fkey" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_gradeLevelId_schoolId_fkey" FOREIGN KEY ("gradeLevelId", "schoolId") REFERENCES "GradeLevel"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
