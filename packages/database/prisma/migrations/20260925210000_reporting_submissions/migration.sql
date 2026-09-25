CREATE TYPE "ReportingSubmissionStatus" AS ENUM ('draft', 'submitted', 'approved', 'returned');
CREATE TABLE "ReportingSubmission" (
    "id" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" "ReportingSubmissionStatus" NOT NULL DEFAULT 'draft',
    "snapshot" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "returnedAt" TIMESTAMP(3),
    "returnedById" TEXT,
    "returnReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReportingSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReportingSubmission_reportingPeriodId_schoolId_key" ON "ReportingSubmission"("reportingPeriodId", "schoolId");
CREATE INDEX "ReportingSubmission_schoolId_status_idx" ON "ReportingSubmission"("schoolId", "status");
CREATE INDEX "ReportingSubmission_reportingPeriodId_status_idx" ON "ReportingSubmission"("reportingPeriodId", "status");
ALTER TABLE "ReportingSubmission" ADD CONSTRAINT "ReportingSubmission_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportingSubmission" ADD CONSTRAINT "ReportingSubmission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;