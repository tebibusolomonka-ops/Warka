CREATE TYPE "GradebookLockAction" AS ENUM ('locked', 'unlocked');

CREATE TABLE "GradebookLock" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "gradingPeriodId" TEXT NOT NULL,
    "schoolClassId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GradebookLock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradebookLockEvent" (
    "id" TEXT NOT NULL,
    "lockId" TEXT NOT NULL,
    "action" "GradebookLockAction" NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradebookLockEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GradebookLock_context_key" ON "GradebookLock"("schoolId", "academicYearId", "gradingPeriodId", "schoolClassId", "subjectId");
CREATE INDEX "GradebookLock_schoolId_locked_idx" ON "GradebookLock"("schoolId", "locked");
CREATE INDEX "GradebookLockEvent_lockId_effectiveAt_idx" ON "GradebookLockEvent"("lockId", "effectiveAt");
ALTER TABLE "GradebookLock" ADD CONSTRAINT "GradebookLock_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradebookLock" ADD CONSTRAINT "GradebookLock_academicYearId_schoolId_fkey" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradebookLock" ADD CONSTRAINT "GradebookLock_gradingPeriodId_schoolId_academicYearId_fkey" FOREIGN KEY ("gradingPeriodId", "schoolId", "academicYearId") REFERENCES "GradingPeriod"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradebookLock" ADD CONSTRAINT "GradebookLock_schoolClassId_schoolId_academicYearId_fkey" FOREIGN KEY ("schoolClassId", "schoolId", "academicYearId") REFERENCES "SchoolClass"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradebookLock" ADD CONSTRAINT "GradebookLock_subjectId_schoolId_fkey" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "Subject"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradebookLockEvent" ADD CONSTRAINT "GradebookLockEvent_lockId_fkey" FOREIGN KEY ("lockId") REFERENCES "GradebookLock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradebookLockEvent" ADD CONSTRAINT "GradebookLockEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
