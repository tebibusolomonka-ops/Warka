CREATE TYPE "MarkModerationStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE TABLE "MarkModerationRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "markId" TEXT NOT NULL,
    "originalScore" DECIMAL(8,2) NOT NULL,
    "proposedScore" DECIMAL(8,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "MarkModerationStatus" NOT NULL DEFAULT 'pending',
    "requestedById" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarkModerationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarkModerationRequest_schoolId_status_idx" ON "MarkModerationRequest"("schoolId", "status");
CREATE INDEX "MarkModerationRequest_markId_createdAt_idx" ON "MarkModerationRequest"("markId", "createdAt");
CREATE UNIQUE INDEX "MarkModerationRequest_one_pending_per_mark" ON "MarkModerationRequest"("markId") WHERE "status" = 'pending';
ALTER TABLE "MarkModerationRequest" ADD CONSTRAINT "MarkModerationRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarkModerationRequest" ADD CONSTRAINT "MarkModerationRequest_markId_fkey" FOREIGN KEY ("markId") REFERENCES "Mark"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarkModerationRequest" ADD CONSTRAINT "MarkModerationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarkModerationRequest" ADD CONSTRAINT "MarkModerationRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
