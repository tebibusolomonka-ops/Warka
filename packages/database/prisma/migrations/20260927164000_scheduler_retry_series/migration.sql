ALTER TABLE "ScheduledTaskExecution" ADD COLUMN "seriesId" TEXT;
UPDATE "ScheduledTaskExecution" SET "seriesId" = "id";
ALTER TABLE "ScheduledTaskExecution" ALTER COLUMN "seriesId" SET NOT NULL;
CREATE UNIQUE INDEX "ScheduledTaskExecution_seriesId_attempt_key" ON "ScheduledTaskExecution"("seriesId", "attempt");
