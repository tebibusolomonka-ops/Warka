CREATE TYPE "UploadSessionStatus" AS ENUM ('created','uploading','assembled','completed','cancelled','expired');
CREATE TABLE "UploadSession" ("id" TEXT NOT NULL, "purpose" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL, "schoolId" TEXT, "expectedSize" BIGINT NOT NULL, "receivedSize" BIGINT NOT NULL DEFAULT 0, "contentType" TEXT NOT NULL, "safeFilename" TEXT NOT NULL, "status" "UploadSessionStatus" NOT NULL DEFAULT 'created', "expectedChecksum" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "UploadSession_pkey" PRIMARY KEY ("id"));
CREATE INDEX "UploadSession_ownerUserId_status_idx" ON "UploadSession"("ownerUserId","status");
CREATE INDEX "UploadSession_schoolId_status_idx" ON "UploadSession"("schoolId","status");
