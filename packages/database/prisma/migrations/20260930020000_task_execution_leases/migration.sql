ALTER TABLE "ScheduledTaskExecution"
ADD COLUMN "claimedAt" TIMESTAMP(3),
ADD COLUMN "leaseExpiresAt" TIMESTAMP(3),
ADD COLUMN "heartbeatAt" TIMESTAMP(3),
ADD COLUMN "workerId" TEXT;

CREATE INDEX "ScheduledTaskExecution_status_leaseExpiresAt_idx"
ON "ScheduledTaskExecution"("status", "leaseExpiresAt");
