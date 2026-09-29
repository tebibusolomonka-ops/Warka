ALTER TYPE "ScheduledTaskStatus" ADD VALUE 'interrupted';

CREATE TYPE "TaskRecoveryDisposition" AS ENUM ('safeToRetry', 'needsReconciliation', 'manualReview');

ALTER TABLE "ScheduledTaskExecution"
ADD COLUMN "interruptedAt" TIMESTAMP(3),
ADD COLUMN "recoveryDisposition" "TaskRecoveryDisposition",
ADD COLUMN "recoveryReason" TEXT;

CREATE INDEX "ScheduledTaskExecution_status_startedAt_idx"
ON "ScheduledTaskExecution"("status", "startedAt");
