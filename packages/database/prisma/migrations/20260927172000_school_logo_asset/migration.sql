ALTER TABLE "SchoolDocumentProfile" ADD COLUMN "logoAssetId" TEXT;
CREATE UNIQUE INDEX "SchoolDocumentProfile_logoAssetId_key" ON "SchoolDocumentProfile"("logoAssetId");
ALTER TABLE "SchoolDocumentProfile" ADD CONSTRAINT "SchoolDocumentProfile_logoAssetId_fkey" FOREIGN KEY ("logoAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
