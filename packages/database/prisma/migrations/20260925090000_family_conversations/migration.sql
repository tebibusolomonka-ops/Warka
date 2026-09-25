CREATE TYPE "FamilyConversationRoute" AS ENUM ('teacher', 'schoolOffice');

CREATE TYPE "FamilyConversationStatus" AS ENUM ('open', 'closed');

CREATE TABLE "FamilyConversation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "route" "FamilyConversationRoute" NOT NULL,
    "teacherUserId" TEXT,
    "status" "FamilyConversationStatus" NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FamilyMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "FamilyMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FamilyConversation_guardianId_createdAt_idx" ON "FamilyConversation"("guardianId", "createdAt");

CREATE INDEX "FamilyConversation_schoolId_route_status_createdAt_idx" ON "FamilyConversation"("schoolId", "route", "status", "createdAt");

CREATE INDEX "FamilyConversation_teacherUserId_status_createdAt_idx" ON "FamilyConversation"("teacherUserId", "status", "createdAt");

CREATE INDEX "FamilyMessage_conversationId_createdAt_id_idx" ON "FamilyMessage"("conversationId", "createdAt", "id");

ALTER TABLE "FamilyConversation" ADD CONSTRAINT "FamilyConversation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FamilyConversation" ADD CONSTRAINT "FamilyConversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FamilyConversation" ADD CONSTRAINT "FamilyConversation_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FamilyConversation" ADD CONSTRAINT "FamilyConversation_teacherUserId_fkey" FOREIGN KEY ("teacherUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FamilyConversation" ADD CONSTRAINT "FamilyConversation_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FamilyMessage" ADD CONSTRAINT "FamilyMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "FamilyConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FamilyMessage" ADD CONSTRAINT "FamilyMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
