-- Scheduler claims are filtered by task type and state, then ordered by due time.
CREATE INDEX "ScheduledTaskExecution_taskType_status_scheduledFor_idx"
ON "ScheduledTaskExecution"("taskType", "status", "scheduledFor");

-- Failed outbox retry scans filter by state/failure code and age.
CREATE INDEX "EmailDelivery_status_failureCode_failedAt_idx"
ON "EmailDelivery"("status", "failureCode", "failedAt");

-- School-scoped student lookup joins begin from enrollment membership.
CREATE INDEX "Enrollment_schoolId_studentId_idx"
ON "Enrollment"("schoolId", "studentId");

-- Coursework lists use school scope with stable newest-first pagination.
CREATE INDEX "CourseworkAssignment_schoolId_createdAt_id_idx"
ON "CourseworkAssignment"("schoolId", "createdAt", "id");
