CREATE TYPE "AccessReviewStatus" AS ENUM ('open', 'completed');
CREATE TYPE "AccessReviewDecision" AS ENUM ('pending', 'confirmed', 'revoke');
CREATE TYPE "AccessReviewType" AS ENUM ('organizationMembership', 'schoolMembership', 'bureauAccess');

CREATE TABLE "AccessReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schoolId" TEXT,
    "startedById" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "status" "AccessReviewStatus" NOT NULL DEFAULT 'open',
    CONSTRAINT "AccessReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccessReviewEntry" (
    "id" TEXT NOT NULL,
    "accessReviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessType" "AccessReviewType" NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schoolId" TEXT,
    "currentRole" TEXT NOT NULL,
    "sourceId" TEXT,
    "decision" "AccessReviewDecision" NOT NULL DEFAULT 'pending',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    CONSTRAINT "AccessReviewEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccessReview_organizationId_status_startedAt_idx" ON "AccessReview"("organizationId", "status", "startedAt");
CREATE INDEX "AccessReview_schoolId_status_startedAt_idx" ON "AccessReview"("schoolId", "status", "startedAt");
CREATE INDEX "AccessReviewEntry_accessReviewId_decision_idx" ON "AccessReviewEntry"("accessReviewId", "decision");
CREATE INDEX "AccessReviewEntry_userId_idx" ON "AccessReviewEntry"("userId");
CREATE UNIQUE INDEX "AccessReviewEntry_accessReviewId_accessType_userId_organizationId_schoolId_key" ON "AccessReviewEntry"("accessReviewId", "accessType", "userId", "organizationId", "schoolId");
ALTER TABLE "AccessReviewEntry" ADD CONSTRAINT "AccessReviewEntry_accessReviewId_fkey" FOREIGN KEY ("accessReviewId") REFERENCES "AccessReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;