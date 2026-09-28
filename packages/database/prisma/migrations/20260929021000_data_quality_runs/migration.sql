CREATE TYPE "DataQualityRunTrigger" AS ENUM ('manual', 'scheduled', 'reportingValidation');
CREATE TYPE "DataQualityRunStatus" AS ENUM ('running', 'completed', 'failed');
CREATE TABLE "DataQualityRun" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "trigger" "DataQualityRunTrigger" NOT NULL,
    "status" "DataQualityRunStatus" NOT NULL DEFAULT 'running',
    "checksExecuted" TEXT[] NOT NULL,
    "infoCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "blockingCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failureCode" VARCHAR(80),
    CONSTRAINT "DataQualityRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DataQualityRun_schoolId_startedAt_idx" ON "DataQualityRun"("schoolId", "startedAt");
CREATE UNIQUE INDEX "DataQualityRun_one_running_per_school_idx" ON "DataQualityRun"("schoolId") WHERE "status" = 'running';
ALTER TABLE "DataQualityRun" ADD CONSTRAINT "DataQualityRun_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
