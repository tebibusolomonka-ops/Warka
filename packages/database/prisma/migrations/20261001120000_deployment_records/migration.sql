CREATE TYPE "DeploymentStatus" AS ENUM ('planned', 'deploying', 'healthy', 'failed', 'rolledBack');

CREATE TABLE "DeploymentRecord" (
  "id" TEXT NOT NULL,
  "releaseVersion" TEXT NOT NULL,
  "revision" TEXT NOT NULL,
  "environmentLabel" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "status" "DeploymentStatus" NOT NULL DEFAULT 'planned',
  "initiatedBy" TEXT,
  "manifestChecksum" TEXT NOT NULL,
  "failureSummary" TEXT,
  CONSTRAINT "DeploymentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeploymentRecord_environmentLabel_startedAt_idx" ON "DeploymentRecord"("environmentLabel", "startedAt");
CREATE INDEX "DeploymentRecord_releaseVersion_revision_idx" ON "DeploymentRecord"("releaseVersion", "revision");
