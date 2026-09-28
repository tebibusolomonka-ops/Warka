CREATE TYPE "MeetingEventKind" AS ENUM ('requested', 'scheduled', 'rescheduled', 'declined', 'cancelled', 'completed');

CREATE TABLE "MeetingEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" "MeetingEventKind" NOT NULL,
    "reason" VARCHAR(300),
    "previousStartAt" TIMESTAMP(3),
    "previousEndAt" TIMESTAMP(3),
    "newStartAt" TIMESTAMP(3),
    "newEndAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetingEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MeetingEvent_requestId_createdAt_idx" ON "MeetingEvent"("requestId", "createdAt");
ALTER TABLE "MeetingEvent" ADD CONSTRAINT "MeetingEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ParentTeacherMeetingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MeetingEvent" ADD CONSTRAINT "MeetingEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
