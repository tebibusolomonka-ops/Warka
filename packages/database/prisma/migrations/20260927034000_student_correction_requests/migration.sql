CREATE TYPE "CorrectionRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE "StudentCorrectionField" AS ENUM ('givenName', 'familyName', 'dateOfBirth');
CREATE TABLE "StudentCorrectionRequest" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "field" "StudentCorrectionField" NOT NULL,
  "previousValue" TEXT,
  "proposedValue" TEXT,
  "reason" TEXT NOT NULL,
  "status" "CorrectionRequestStatus" NOT NULL DEFAULT 'pending',
  "requestedById" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  CONSTRAINT "StudentCorrectionRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StudentCorrectionRequest_schoolId_status_requestedAt_idx" ON "StudentCorrectionRequest"("schoolId", "status", "requestedAt");
CREATE INDEX "StudentCorrectionRequest_studentId_requestedAt_idx" ON "StudentCorrectionRequest"("studentId", "requestedAt");
CREATE UNIQUE INDEX "StudentCorrectionRequest_pending_field_key" ON "StudentCorrectionRequest"("studentId", "field") WHERE "status" = 'pending';
ALTER TABLE "StudentCorrectionRequest" ADD CONSTRAINT "StudentCorrectionRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentCorrectionRequest" ADD CONSTRAINT "StudentCorrectionRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentCorrectionRequest" ADD CONSTRAINT "StudentCorrectionRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentCorrectionRequest" ADD CONSTRAINT "StudentCorrectionRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
