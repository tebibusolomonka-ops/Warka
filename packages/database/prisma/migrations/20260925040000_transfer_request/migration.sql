CREATE TYPE "TransferStatus" AS ENUM ('requested', 'approvedBySendingSchool', 'acceptedByReceivingSchool', 'rejected', 'cancelled');

CREATE TABLE "TransferRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sendingSchoolId" TEXT NOT NULL,
    "receivingSchoolId" TEXT NOT NULL,
    "sourceEnrollmentId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'requested',
    "transferPackage" JSONB NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TransferRequest_sendingSchoolId_status_requestedAt_idx" ON "TransferRequest"("sendingSchoolId", "status", "requestedAt");

CREATE INDEX "TransferRequest_receivingSchoolId_status_requestedAt_idx" ON "TransferRequest"("receivingSchoolId", "status", "requestedAt");

CREATE INDEX "TransferRequest_studentId_requestedAt_idx" ON "TransferRequest"("studentId", "requestedAt");

ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_sendingSchoolId_fkey" FOREIGN KEY ("sendingSchoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_receivingSchoolId_fkey" FOREIGN KEY ("receivingSchoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_sourceEnrollmentId_sendingSchoolId_student_fkey" FOREIGN KEY ("sourceEnrollmentId", "sendingSchoolId", "studentId") REFERENCES "Enrollment"("id", "schoolId", "studentId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_different_schools_check" CHECK ("sendingSchoolId" <> "receivingSchoolId");
CREATE UNIQUE INDEX "TransferRequest_student_active_key" ON "TransferRequest"("studentId") WHERE "status" IN ('requested', 'approvedBySendingSchool');
