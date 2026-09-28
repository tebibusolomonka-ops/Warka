ALTER TABLE "ReportingSubmission" ADD COLUMN "currentVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ReportingSubmissionVersion" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "validationSummary" JSONB NOT NULL,
    "status" "ReportingSubmissionStatus" NOT NULL DEFAULT 'submitted',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedById" TEXT NOT NULL,
    CONSTRAINT "ReportingSubmissionVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReportingSubmissionVersion_submissionId_version_key" ON "ReportingSubmissionVersion"("submissionId", "version");
CREATE INDEX "ReportingSubmissionVersion_submittedById_idx" ON "ReportingSubmissionVersion"("submittedById");
ALTER TABLE "ReportingSubmissionVersion" ADD CONSTRAINT "ReportingSubmissionVersion_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ReportingSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportingSubmissionVersion" ADD CONSTRAINT "ReportingSubmissionVersion_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
