-- CreateEnum
CREATE TYPE "SubmissionReviewStatus" AS ENUM ('pending', 'reviewed', 'returned');

-- CreateTable
CREATE TABLE "SubmissionReview" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "status" "SubmissionReviewStatus" NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resubmissionAllowed" BOOLEAN NOT NULL DEFAULT false,
    "resubmissionDueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionReview_revisionId_key" ON "SubmissionReview"("revisionId");

-- CreateIndex
CREATE INDEX "SubmissionReview_status_createdAt_idx" ON "SubmissionReview"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "SubmissionReview" ADD CONSTRAINT "SubmissionReview_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "SubmissionRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionReview" ADD CONSTRAINT "SubmissionReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
