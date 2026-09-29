CREATE TYPE "RecoveryReviewStatus" AS ENUM ('open', 'resolved', 'dismissed');
CREATE TYPE "RecoveryDomain" AS ENUM ('scheduledTask', 'emailDelivery', 'fileScan', 'backup', 'restoreRehearsal');

CREATE TABLE "RecoveryReview" (
  "id" TEXT NOT NULL,
  "domain" "RecoveryDomain" NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceReference" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "status" "RecoveryReviewStatus" NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "resolution" TEXT,
  CONSTRAINT "RecoveryReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecoveryReview_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "RecoveryReview_status_createdAt_idx" ON "RecoveryReview"("status", "createdAt");
CREATE INDEX "RecoveryReview_domain_resourceReference_idx" ON "RecoveryReview"("domain", "resourceReference");
