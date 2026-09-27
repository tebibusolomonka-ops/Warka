CREATE TYPE "ScheduledTaskType" AS ENUM ('backup');
CREATE TYPE "ScheduledTaskStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped');

CREATE TABLE "ScheduledTaskExecution" (
  "id" TEXT NOT NULL,
  "taskType" "ScheduledTaskType" NOT NULL,
  "scope" TEXT NOT NULL,
  "resourceId" TEXT,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "status" "ScheduledTaskStatus" NOT NULL DEFAULT 'pending',
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduledTaskExecution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScheduledTaskExecution_taskType_scope_scheduledFor_idx" ON "ScheduledTaskExecution"("taskType", "scope", "scheduledFor");
CREATE INDEX "ScheduledTaskExecution_status_createdAt_idx" ON "ScheduledTaskExecution"("status", "createdAt");
