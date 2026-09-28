CREATE TABLE "AttendanceCorrection" (
  "id" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "previousStatus" "StudentAttendanceStatus" NOT NULL,
  "newStatus" "StudentAttendanceStatus" NOT NULL,
  "reason" TEXT NOT NULL,
  "performedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceCorrection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceCorrection_reason_check" CHECK (char_length("reason") BETWEEN 8 AND 500)
);
CREATE INDEX "AttendanceCorrection_recordId_effectiveAt_idx" ON "AttendanceCorrection"("recordId", "effectiveAt");
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "StudentAttendanceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceCorrection" ADD CONSTRAINT "AttendanceCorrection_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
