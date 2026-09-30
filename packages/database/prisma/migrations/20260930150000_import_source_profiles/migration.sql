CREATE TYPE "ImportSourceFormat" AS ENUM ('csv', 'xlsx');
CREATE TABLE "ImportSourceProfile" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "schoolId" TEXT,
  "organizationId" TEXT,
  "format" "ImportSourceFormat" NOT NULL,
  "entityType" "ExternalEntityType" NOT NULL,
  "mapping" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportSourceProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImportSourceProfile_exactly_one_scope" CHECK (("schoolId" IS NULL) <> ("organizationId" IS NULL)),
  CONSTRAINT "ImportSourceProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ImportSourceProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ImportSourceProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ImportSourceProfile_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ImportSourceProfile_schoolId_entityType_idx" ON "ImportSourceProfile"("schoolId", "entityType");
CREATE INDEX "ImportSourceProfile_organizationId_entityType_idx" ON "ImportSourceProfile"("organizationId", "entityType");
