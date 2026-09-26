CREATE TYPE "ImportJobType" AS ENUM ('studentRegistration');
CREATE TYPE "ImportJobStatus" AS ENUM ('uploaded', 'validated', 'invalid', 'applied', 'cancelled');
CREATE TYPE "ImportIssueSeverity" AS ENUM ('error', 'warning');

CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "type" "ImportJobType" NOT NULL DEFAULT 'studentRegistration',
    "status" "ImportJobStatus" NOT NULL DEFAULT 'uploaded',
    "originalFileName" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "normalizedRows" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportRowIssue" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "severity" "ImportIssueSeverity" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    CONSTRAINT "ImportRowIssue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportJob_schoolId_createdAt_idx" ON "ImportJob"("schoolId", "createdAt");
CREATE INDEX "ImportRowIssue_jobId_rowNumber_idx" ON "ImportRowIssue"("jobId", "rowNumber");

ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportRowIssue" ADD CONSTRAINT "ImportRowIssue_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
