CREATE TYPE "SupportRequestCategory" AS ENUM ('account', 'studentRecords', 'academicResults', 'documents', 'reporting', 'technical');
CREATE TYPE "SupportRequestSeverity" AS ENUM ('low', 'normal', 'high', 'critical');
CREATE TYPE "SupportRequestStatus" AS ENUM ('open', 'inProgress', 'waitingForSchool', 'resolved', 'closed');
CREATE TABLE "SupportRequest" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "category" "SupportRequestCategory" NOT NULL,
  "severity" "SupportRequestSeverity" NOT NULL DEFAULT 'normal',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "SupportRequestStatus" NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportRequest_schoolId_status_createdAt_idx" ON "SupportRequest"("schoolId", "status", "createdAt");
CREATE INDEX "SupportRequest_createdById_createdAt_idx" ON "SupportRequest"("createdById", "createdAt");
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
