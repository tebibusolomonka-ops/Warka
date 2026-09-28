-- AlterEnum
ALTER TYPE "FileAssetPurpose" ADD VALUE 'courseworkSubmission';

-- CreateTable
CREATE TABLE "SubmissionAttachment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "SubmissionAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionAttachment_fileAssetId_key" ON "SubmissionAttachment"("fileAssetId");

-- CreateIndex
CREATE INDEX "SubmissionAttachment_revisionId_removedAt_idx" ON "SubmissionAttachment"("revisionId", "removedAt");

-- CreateIndex
CREATE INDEX "SubmissionAttachment_schoolId_createdAt_idx" ON "SubmissionAttachment"("schoolId", "createdAt");

-- AddForeignKey
ALTER TABLE "SubmissionAttachment" ADD CONSTRAINT "SubmissionAttachment_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "SubmissionRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAttachment" ADD CONSTRAINT "SubmissionAttachment_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
