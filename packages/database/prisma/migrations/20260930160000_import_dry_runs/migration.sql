CREATE TYPE "ImportDryRunStatus" AS ENUM ('successful', 'invalid', 'superseded', 'applied');
CREATE TABLE "ImportDryRun" (
  "id" TEXT NOT NULL, "importJobId" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "status" "ImportDryRunStatus" NOT NULL, "fileChecksum" TEXT NOT NULL,
  "sourceProfileId" TEXT NOT NULL, "mappingChecksum" TEXT NOT NULL,
  "transformChecksum" TEXT NOT NULL, "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "appliedAt" TIMESTAMP(3),
  CONSTRAINT "ImportDryRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImportDryRun_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ImportDryRun_sourceProfileId_fkey" FOREIGN KEY ("sourceProfileId") REFERENCES "ImportSourceProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ImportDryRun_importJobId_version_key" ON "ImportDryRun"("importJobId", "version");
CREATE INDEX "ImportDryRun_sourceProfileId_createdAt_idx" ON "ImportDryRun"("sourceProfileId", "createdAt");
