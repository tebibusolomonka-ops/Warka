CREATE TYPE "EmailDeliveryStatus" AS ENUM ('queued', 'sending', 'sent', 'failed', 'cancelled');

CREATE TABLE "EmailDelivery" (
  "id" TEXT NOT NULL,
  "recipientUserId" TEXT,
  "recipientAddress" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'queued',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "providerMessageId" TEXT,
  "failureCode" TEXT,
  CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailDelivery_status_scheduledAt_idx" ON "EmailDelivery"("status", "scheduledAt");
CREATE INDEX "EmailDelivery_recipientUserId_createdAt_idx" ON "EmailDelivery"("recipientUserId", "createdAt");
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
