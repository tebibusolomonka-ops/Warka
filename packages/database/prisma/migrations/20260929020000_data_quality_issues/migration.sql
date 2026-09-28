CREATE TYPE "DataQualitySeverity" AS ENUM ('info', 'warning', 'blocking');
CREATE TYPE "DataQualityIssueStatus" AS ENUM ('open', 'resolved', 'dismissed');

CREATE TABLE "DataQualityIssue" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "severity" "DataQualitySeverity" NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "status" "DataQualityIssueStatus" NOT NULL DEFAULT 'open',
    "entityType" VARCHAR(40),
    "entityId" TEXT,
    "summary" VARCHAR(240) NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "dismissedById" TEXT,
    "dismissalReason" VARCHAR(500),
    CONSTRAINT "DataQualityIssue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DataQualityIssue_schoolId_status_severity_detectedAt_idx" ON "DataQualityIssue"("schoolId", "status", "severity", "detectedAt");
CREATE INDEX "DataQualityIssue_schoolId_category_code_idx" ON "DataQualityIssue"("schoolId", "category", "code");
ALTER TABLE "DataQualityIssue" ADD CONSTRAINT "DataQualityIssue_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataQualityIssue" ADD CONSTRAINT "DataQualityIssue_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataQualityIssue" ADD CONSTRAINT "DataQualityIssue_dismissedById_fkey" FOREIGN KEY ("dismissedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
