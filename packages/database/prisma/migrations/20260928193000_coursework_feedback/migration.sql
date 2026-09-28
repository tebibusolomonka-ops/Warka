-- CreateEnum
CREATE TYPE "CourseworkFeedbackStatus" AS ENUM ('draft', 'released');

-- CreateTable
CREATE TABLE "CourseworkFeedback" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "CourseworkFeedbackStatus" NOT NULL DEFAULT 'draft',
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "CourseworkFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseworkFeedback_revisionId_key" ON "CourseworkFeedback"("revisionId");

-- CreateIndex
CREATE INDEX "CourseworkFeedback_status_releasedAt_idx" ON "CourseworkFeedback"("status", "releasedAt");

-- AddForeignKey
ALTER TABLE "CourseworkFeedback" ADD CONSTRAINT "CourseworkFeedback_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "SubmissionRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseworkFeedback" ADD CONSTRAINT "CourseworkFeedback_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
