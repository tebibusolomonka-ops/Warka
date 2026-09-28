ALTER TABLE "ParentTeacherMeetingRequest"
ADD COLUMN "scheduledStartAt" TIMESTAMP(3),
ADD COLUMN "scheduledEndAt" TIMESTAMP(3),
ADD COLUMN "meetingMethod" "MeetingMethod",
ADD COLUMN "schoolLocation" VARCHAR(200);

CREATE INDEX "ParentTeacherMeetingRequest_schoolId_teacherId_scheduledStartAt_idx" ON "ParentTeacherMeetingRequest"("schoolId", "teacherId", "scheduledStartAt");
