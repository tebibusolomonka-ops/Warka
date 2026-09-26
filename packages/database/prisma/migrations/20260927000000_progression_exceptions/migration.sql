CREATE TYPE "ProgressionExceptionKind" AS ENUM ('missingTargetClass', 'existingTargetEnrollment', 'withdrawnSource', 'unresolvedTransfer', 'incompleteSource', 'manualReview');
CREATE TYPE "ProgressionExceptionStatus" AS ENUM ('open', 'resolved');
CREATE TABLE "ProgressionException" (
    "id" TEXT NOT NULL, "planId" TEXT NOT NULL, "entryId" TEXT NOT NULL, "kind" "ProgressionExceptionKind" NOT NULL,
    "status" "ProgressionExceptionStatus" NOT NULL DEFAULT 'open', "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3), "resolvedById" TEXT, "resolutionNote" TEXT,
    CONSTRAINT "ProgressionException_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProgressionException_planId_status_idx" ON "ProgressionException"("planId", "status");
CREATE INDEX "ProgressionException_entryId_kind_idx" ON "ProgressionException"("entryId", "kind");
CREATE UNIQUE INDEX "ProgressionException_open_key" ON "ProgressionException"("entryId", "kind") WHERE "status" = 'open';
ALTER TABLE "ProgressionException" ADD CONSTRAINT "ProgressionException_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProgressionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressionException" ADD CONSTRAINT "ProgressionException_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ProgressionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressionException" ADD CONSTRAINT "ProgressionException_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
