CREATE TABLE "LoginAttemptBucket" (
  "emailHash" TEXT NOT NULL,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "windowStartsAt" TIMESTAMP(3) NOT NULL,
  "blockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoginAttemptBucket_pkey" PRIMARY KEY ("emailHash")
);
CREATE INDEX "LoginAttemptBucket_blockedUntil_idx" ON "LoginAttemptBucket"("blockedUntil");
