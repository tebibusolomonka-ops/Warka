CREATE TABLE "GradingPeriod" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradingPeriod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GradingPeriod_schoolId_academicYearId_startsOn_idx" ON "GradingPeriod"("schoolId", "academicYearId", "startsOn");

CREATE UNIQUE INDEX "GradingPeriod_schoolId_academicYearId_name_key" ON "GradingPeriod"("schoolId", "academicYearId", "name");

CREATE UNIQUE INDEX "GradingPeriod_id_schoolId_academicYearId_key" ON "GradingPeriod"("id", "schoolId", "academicYearId");

ALTER TABLE "GradingPeriod" ADD CONSTRAINT "GradingPeriod_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GradingPeriod" ADD CONSTRAINT "GradingPeriod_academicYearId_schoolId_fkey" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
