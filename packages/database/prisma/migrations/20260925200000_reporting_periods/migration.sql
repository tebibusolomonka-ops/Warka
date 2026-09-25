CREATE TYPE "ReportingPeriodStatus" AS ENUM ('draft', 'open', 'closed');
CREATE TABLE "ReportingPeriod" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "submissionDueOn" DATE NOT NULL,
    "status" "ReportingPeriodStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReportingPeriod_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ReportingRequirement" (
    "id" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportingRequirement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReportingPeriod_organizationId_name_key" ON "ReportingPeriod"("organizationId", "name");
CREATE INDEX "ReportingPeriod_organizationId_status_startsOn_idx" ON "ReportingPeriod"("organizationId", "status", "startsOn");
CREATE UNIQUE INDEX "ReportingRequirement_reportingPeriodId_schoolId_key" ON "ReportingRequirement"("reportingPeriodId", "schoolId");
CREATE INDEX "ReportingRequirement_schoolId_idx" ON "ReportingRequirement"("schoolId");
ALTER TABLE "ReportingPeriod" ADD CONSTRAINT "ReportingPeriod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportingRequirement" ADD CONSTRAINT "ReportingRequirement_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportingRequirement" ADD CONSTRAINT "ReportingRequirement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;