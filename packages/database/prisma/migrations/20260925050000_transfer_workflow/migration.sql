ALTER TABLE "Enrollment" ADD COLUMN     "withdrawalReason" TEXT;

ALTER TABLE "TransferRequest" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "acceptedById" TEXT,
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "receivingEnrollmentId" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedById" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "sendingApprovedAt" TIMESTAMP(3),
ADD COLUMN     "sendingApprovedById" TEXT;

CREATE UNIQUE INDEX "TransferRequest_receivingEnrollmentId_key" ON "TransferRequest"("receivingEnrollmentId");

CREATE UNIQUE INDEX "TransferRequest_receivingEnrollmentId_receivingSchoolId_stu_key" ON "TransferRequest"("receivingEnrollmentId", "receivingSchoolId", "studentId");

ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_sendingApprovedById_fkey" FOREIGN KEY ("sendingApprovedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_receivingEnrollmentId_receivingSchoolId_st_fkey" FOREIGN KEY ("receivingEnrollmentId", "receivingSchoolId", "studentId") REFERENCES "Enrollment"("id", "schoolId", "studentId") ON DELETE RESTRICT ON UPDATE CASCADE;
