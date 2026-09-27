ALTER TYPE "ScheduledTaskType" ADD VALUE 'retentionEvaluation';
ALTER TABLE "ScheduledTaskExecution" ADD COLUMN "eligibleCount" INTEGER;
ALTER TABLE "ScheduledTaskExecution" ADD COLUMN "oldestEligibleAt" TIMESTAMP(3);
