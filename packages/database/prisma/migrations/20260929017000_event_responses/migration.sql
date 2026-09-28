CREATE TYPE "EventResponseStatus" AS ENUM ('going', 'notGoing');
ALTER TABLE "SchoolEvent" ADD COLUMN "rsvpEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "EventResponse" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "respondentUserId" TEXT NOT NULL,
    "subjectKey" VARCHAR(100) NOT NULL,
    "studentId" TEXT,
    "status" "EventResponseStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EventResponse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventResponse_eventId_respondentUserId_subjectKey_key" ON "EventResponse"("eventId", "respondentUserId", "subjectKey");
CREATE INDEX "EventResponse_schoolId_eventId_status_idx" ON "EventResponse"("schoolId", "eventId", "status");
ALTER TABLE "EventResponse" ADD CONSTRAINT "EventResponse_eventId_schoolId_fkey" FOREIGN KEY ("eventId", "schoolId") REFERENCES "SchoolEvent"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventResponse" ADD CONSTRAINT "EventResponse_respondentUserId_fkey" FOREIGN KEY ("respondentUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventResponse" ADD CONSTRAINT "EventResponse_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "EventResponseHistory" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "previousStatus" "EventResponseStatus",
    "newStatus" "EventResponseStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventResponseHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EventResponseHistory_responseId_createdAt_idx" ON "EventResponseHistory"("responseId", "createdAt");
ALTER TABLE "EventResponseHistory" ADD CONSTRAINT "EventResponseHistory_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "EventResponse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventResponseHistory" ADD CONSTRAINT "EventResponseHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
