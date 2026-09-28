-- AlterEnum
ALTER TYPE "FileAssetPurpose" ADD VALUE 'courseworkAssignment';

-- CreateTable
CREATE TABLE "CourseworkAttachment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "CourseworkAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseworkAttachment_fileAssetId_key" ON "CourseworkAttachment"("fileAssetId");

-- CreateIndex
CREATE INDEX "CourseworkAttachment_assignmentId_removedAt_idx" ON "CourseworkAttachment"("assignmentId", "removedAt");

-- CreateIndex
CREATE INDEX "CourseworkAttachment_schoolId_createdAt_idx" ON "CourseworkAttachment"("schoolId", "createdAt");

-- AddForeignKey
ALTER TABLE "CourseworkAttachment" ADD CONSTRAINT "CourseworkAttachment_assignmentId_schoolId_fkey" FOREIGN KEY ("assignmentId", "schoolId") REFERENCES "CourseworkAssignment"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseworkAttachment" ADD CONSTRAINT "CourseworkAttachment_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseworkAttachment" ADD CONSTRAINT "CourseworkAttachment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
