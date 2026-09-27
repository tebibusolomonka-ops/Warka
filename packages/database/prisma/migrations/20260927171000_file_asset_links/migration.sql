ALTER TABLE "FileAsset" ADD COLUMN "learningMaterialId" TEXT;
ALTER TABLE "FileAsset" ADD COLUMN "issuedDocumentId" TEXT;
CREATE UNIQUE INDEX "FileAsset_learningMaterialId_key" ON "FileAsset"("learningMaterialId");
CREATE UNIQUE INDEX "FileAsset_issuedDocumentId_key" ON "FileAsset"("issuedDocumentId");
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_learningMaterialId_fkey" FOREIGN KEY ("learningMaterialId") REFERENCES "LearningMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_issuedDocumentId_fkey" FOREIGN KEY ("issuedDocumentId") REFERENCES "IssuedDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
