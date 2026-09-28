CREATE TYPE "SchoolCalendarDayType" AS ENUM ('instructional', 'holiday', 'closure', 'examination', 'staffDay');

CREATE TABLE "SchoolCalendarDay" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "dayType" "SchoolCalendarDayType" NOT NULL,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolCalendarDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolCalendarDay_schoolId_date_key" ON "SchoolCalendarDay"("schoolId", "date");
CREATE INDEX "SchoolCalendarDay_schoolId_academicYearId_date_idx" ON "SchoolCalendarDay"("schoolId", "academicYearId", "date");
ALTER TABLE "SchoolCalendarDay" ADD CONSTRAINT "SchoolCalendarDay_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchoolCalendarDay" ADD CONSTRAINT "SchoolCalendarDay_academicYearId_schoolId_fkey" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
