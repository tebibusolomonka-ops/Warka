CREATE TYPE "RetentionCategory" AS ENUM ('messages', 'auditEvents', 'issuedDocuments', 'academicRecords', 'enrollmentRecords');

CREATE TABLE "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" "RetentionCategory" NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RetentionPolicy_organizationId_category_key" ON "RetentionPolicy"("organizationId", "category");
CREATE INDEX "RetentionPolicy_organizationId_updatedAt_idx" ON "RetentionPolicy"("organizationId", "updatedAt");