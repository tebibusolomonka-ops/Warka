CREATE TYPE "ReportingNoteVisibility" AS ENUM ('schoolAndBureau', 'bureauInternal');

CREATE TABLE "ReportingReviewNote" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "visibility" "ReportingNoteVisibility" NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportingReviewNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportingReviewNote_submissionId_createdAt_idx" ON "ReportingReviewNote"("submissionId", "createdAt");
CREATE INDEX "ReportingReviewNote_authorUserId_idx" ON "ReportingReviewNote"("authorUserId");
ALTER TABLE "ReportingReviewNote" ADD CONSTRAINT "ReportingReviewNote_submissionId_version_fkey" FOREIGN KEY ("submissionId", "version") REFERENCES "ReportingSubmissionVersion"("submissionId", "version") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportingReviewNote" ADD CONSTRAINT "ReportingReviewNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
