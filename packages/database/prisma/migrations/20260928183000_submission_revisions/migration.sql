-- CreateTable
CREATE TABLE "SubmissionRevision" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "textResponse" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubmissionRevision_submissionId_submittedAt_idx" ON "SubmissionRevision"("submissionId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionRevision_submissionId_revisionNumber_key" ON "SubmissionRevision"("submissionId", "revisionNumber");

-- AddForeignKey
ALTER TABLE "SubmissionRevision" ADD CONSTRAINT "SubmissionRevision_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "CourseworkSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
