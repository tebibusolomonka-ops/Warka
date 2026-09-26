ALTER TABLE "Session" ADD COLUMN "managementId" TEXT;
UPDATE "Session" SET "managementId" = "id";
ALTER TABLE "Session" ALTER COLUMN "managementId" SET NOT NULL;
CREATE UNIQUE INDEX "Session_managementId_key" ON "Session"("managementId");
