CREATE TYPE "AccountRecoveryStatus" AS ENUM ('pending', 'completed', 'expired', 'cancelled');
CREATE TABLE "AccountRecoveryRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AccountRecoveryStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    CONSTRAINT "AccountRecoveryRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AccountRecoveryRequest_userId_status_idx" ON "AccountRecoveryRequest"("userId", "status");
CREATE INDEX "AccountRecoveryRequest_expiresAt_idx" ON "AccountRecoveryRequest"("expiresAt");
CREATE UNIQUE INDEX "AccountRecoveryRequest_one_pending_per_user" ON "AccountRecoveryRequest"("userId") WHERE "status" = 'pending';
ALTER TABLE "AccountRecoveryRequest" ADD CONSTRAINT "AccountRecoveryRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
