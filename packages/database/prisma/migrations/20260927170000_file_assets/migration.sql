CREATE TYPE "FileAssetPurpose" AS ENUM ('learningMaterial', 'schoolBranding', 'issuedDocument');
CREATE TYPE "FileAssetStatus" AS ENUM ('pending', 'available', 'quarantined', 'deleted');

CREATE TABLE "FileAsset" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT,
  "ownerUserId" TEXT,
  "purpose" "FileAssetPurpose" NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "checksum" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "status" "FileAssetStatus" NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FileAsset_storageKey_key" ON "FileAsset"("storageKey");
CREATE INDEX "FileAsset_schoolId_purpose_status_idx" ON "FileAsset"("schoolId", "purpose", "status");
CREATE INDEX "FileAsset_ownerUserId_purpose_status_idx" ON "FileAsset"("ownerUserId", "purpose", "status");
CREATE INDEX "FileAsset_createdAt_idx" ON "FileAsset"("createdAt");
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
