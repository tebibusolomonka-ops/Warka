ALTER TYPE "FileAssetPurpose" ADD VALUE 'eventAttachment';

CREATE TABLE "EventAttachment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    CONSTRAINT "EventAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventAttachment_fileAssetId_key" ON "EventAttachment"("fileAssetId");
CREATE INDEX "EventAttachment_schoolId_eventId_removedAt_idx" ON "EventAttachment"("schoolId", "eventId", "removedAt");
ALTER TABLE "EventAttachment" ADD CONSTRAINT "EventAttachment_eventId_schoolId_fkey" FOREIGN KEY ("eventId", "schoolId") REFERENCES "SchoolEvent"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventAttachment" ADD CONSTRAINT "EventAttachment_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventAttachment" ADD CONSTRAINT "EventAttachment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
