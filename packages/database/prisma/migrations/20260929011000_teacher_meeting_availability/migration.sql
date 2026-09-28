CREATE TYPE "MeetingMethod" AS ENUM ('inPerson', 'phone', 'online');

CREATE TABLE "TeacherMeetingAvailability" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "method" "MeetingMethod" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeacherMeetingAvailability_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeacherMeetingAvailability_schoolId_teacherId_startsAt_idx" ON "TeacherMeetingAvailability"("schoolId", "teacherId", "startsAt");
ALTER TABLE "TeacherMeetingAvailability" ADD CONSTRAINT "TeacherMeetingAvailability_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherMeetingAvailability" ADD CONSTRAINT "TeacherMeetingAvailability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
