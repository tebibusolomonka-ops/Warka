CREATE TYPE "DocumentRequestStatus" AS ENUM ('requested', 'processing', 'ready', 'rejected', 'cancelled');
CREATE TABLE "DocumentRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'requested',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "issuedDocumentId" TEXT,
    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentRequest_issuedDocumentId_key" ON "DocumentRequest"("issuedDocumentId");
CREATE INDEX "DocumentRequest_studentId_requestedAt_idx" ON "DocumentRequest"("studentId", "requestedAt");
CREATE INDEX "DocumentRequest_schoolId_status_requestedAt_idx" ON "DocumentRequest"("schoolId", "status", "requestedAt");
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_academicYearId_schoolId_fkey" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_issuedDocumentId_fkey" FOREIGN KEY ("issuedDocumentId") REFERENCES "IssuedDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
