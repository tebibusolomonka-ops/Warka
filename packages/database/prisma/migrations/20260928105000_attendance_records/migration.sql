CREATE TYPE "StudentAttendanceStatus" AS ENUM ('present', 'absent', 'late', 'excused');
CREATE UNIQUE INDEX "Enrollment_attendance_scope_key" ON "Enrollment"("id", "schoolId", "academicYearId", "schoolClassId", "studentId");
CREATE UNIQUE INDEX "AttendanceSession_record_scope_key" ON "AttendanceSession"("id", "schoolId", "academicYearId", "schoolClassId");

CREATE TABLE "StudentAttendanceRecord" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "schoolClassId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "status" "StudentAttendanceStatus" NOT NULL,
  "note" TEXT,
  "recordedById" TEXT NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentAttendanceRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentAttendanceRecord_note_check" CHECK ("note" IS NULL OR char_length("note") <= 240)
);

CREATE UNIQUE INDEX "StudentAttendanceRecord_sessionId_studentId_key" ON "StudentAttendanceRecord"("sessionId", "studentId");
CREATE INDEX "StudentAttendanceRecord_schoolId_studentId_recordedAt_idx" ON "StudentAttendanceRecord"("schoolId", "studentId", "recordedAt");
ALTER TABLE "StudentAttendanceRecord" ADD CONSTRAINT "StudentAttendanceRecord_session_scope_fkey" FOREIGN KEY ("sessionId", "schoolId", "academicYearId", "schoolClassId") REFERENCES "AttendanceSession"("id", "schoolId", "academicYearId", "schoolClassId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentAttendanceRecord" ADD CONSTRAINT "StudentAttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentAttendanceRecord" ADD CONSTRAINT "StudentAttendanceRecord_enrollment_scope_fkey" FOREIGN KEY ("enrollmentId", "schoolId", "academicYearId", "schoolClassId", "studentId") REFERENCES "Enrollment"("id", "schoolId", "academicYearId", "schoolClassId", "studentId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentAttendanceRecord" ADD CONSTRAINT "StudentAttendanceRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
