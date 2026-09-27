CREATE TYPE "EmailDigestStatus" AS ENUM ('queued', 'sending', 'sent', 'failed');

CREATE TABLE "EmailDigest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "windowStartAt" TIMESTAMP(3) NOT NULL,
  "windowEndAt" TIMESTAMP(3) NOT NULL,
  "status" "EmailDigestStatus" NOT NULL DEFAULT 'queued',
  "itemCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "EmailDigest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailDigest_itemCount_check" CHECK ("itemCount" > 0),
  CONSTRAINT "EmailDigest_window_check" CHECK ("windowEndAt" > "windowStartAt")
);

CREATE UNIQUE INDEX "EmailDigest_userId_windowStartAt_windowEndAt_key" ON "EmailDigest"("userId", "windowStartAt", "windowEndAt");
CREATE INDEX "EmailDigest_status_createdAt_idx" ON "EmailDigest"("status", "createdAt");
ALTER TABLE "EmailDigest" ADD CONSTRAINT "EmailDigest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
