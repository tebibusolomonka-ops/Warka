ALTER TABLE "Enrollment" ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "withdrawnById" TEXT;

CREATE INDEX "Enrollment_approvedById_idx" ON "Enrollment"("approvedById");

CREATE INDEX "Enrollment_withdrawnById_idx" ON "Enrollment"("withdrawnById");

ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_withdrawnById_fkey" FOREIGN KEY ("withdrawnById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
