CREATE TYPE "ParentTeacherMeetingStatus" AS ENUM ('requested', 'scheduled', 'declined', 'cancelled', 'completed');

CREATE TABLE "ParentTeacherMeetingRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "guardianUserId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "teachingAssignmentId" TEXT NOT NULL,
    "topic" VARCHAR(300) NOT NULL,
    "status" "ParentTeacherMeetingStatus" NOT NULL DEFAULT 'requested',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ParentTeacherMeetingRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ParentTeacherMeetingRequest_schoolId_teacherId_status_createdAt_idx" ON "ParentTeacherMeetingRequest"("schoolId", "teacherId", "status", "createdAt");
CREATE INDEX "ParentTeacherMeetingRequest_guardianUserId_studentId_createdAt_idx" ON "ParentTeacherMeetingRequest"("guardianUserId", "studentId", "createdAt");
ALTER TABLE "ParentTeacherMeetingRequest" ADD CONSTRAINT "ParentTeacherMeetingRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParentTeacherMeetingRequest" ADD CONSTRAINT "ParentTeacherMeetingRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParentTeacherMeetingRequest" ADD CONSTRAINT "ParentTeacherMeetingRequest_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParentTeacherMeetingRequest" ADD CONSTRAINT "ParentTeacherMeetingRequest_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParentTeacherMeetingRequest" ADD CONSTRAINT "ParentTeacherMeetingRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParentTeacherMeetingRequest" ADD CONSTRAINT "ParentTeacherMeetingRequest_teachingAssignmentId_fkey" FOREIGN KEY ("teachingAssignmentId") REFERENCES "TeachingAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
