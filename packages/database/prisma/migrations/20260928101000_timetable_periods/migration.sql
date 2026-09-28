CREATE TABLE "TimetablePeriod" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startTime" VARCHAR(5) NOT NULL,
  "endTime" VARCHAR(5) NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "instructional" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TimetablePeriod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TimetablePeriod_time_check" CHECK (
    "startTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND
    "endTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND
    "startTime" < "endTime"
  )
);

CREATE UNIQUE INDEX "TimetablePeriod_schoolId_name_key" ON "TimetablePeriod"("schoolId", "name");
CREATE UNIQUE INDEX "TimetablePeriod_schoolId_sortOrder_key" ON "TimetablePeriod"("schoolId", "sortOrder");
CREATE UNIQUE INDEX "TimetablePeriod_id_schoolId_key" ON "TimetablePeriod"("id", "schoolId");
CREATE INDEX "TimetablePeriod_schoolId_startTime_idx" ON "TimetablePeriod"("schoolId", "startTime");
ALTER TABLE "TimetablePeriod" ADD CONSTRAINT "TimetablePeriod_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
