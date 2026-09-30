CREATE TYPE "ExternalEntityType" AS ENUM ('student', 'school', 'staff');

CREATE TABLE "ExternalRecordReference" (
  "id" TEXT NOT NULL,
  "sourceSystem" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "entityType" "ExternalEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  CONSTRAINT "ExternalRecordReference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalRecordReference_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ExternalRecordReference_sourceSystem_entityType_externalId_key"
ON "ExternalRecordReference"("sourceSystem", "entityType", "externalId");
CREATE INDEX "ExternalRecordReference_entityType_entityId_idx"
ON "ExternalRecordReference"("entityType", "entityId");
CREATE INDEX "ExternalRecordReference_createdById_createdAt_idx"
ON "ExternalRecordReference"("createdById", "createdAt");
