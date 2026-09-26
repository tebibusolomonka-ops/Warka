ALTER TABLE "SupportRequest" ADD COLUMN "assignedSupportUserId" TEXT;
ALTER TABLE "SupportRequest" ADD COLUMN "resolutionSummary" TEXT;
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_assignedSupportUserId_fkey" FOREIGN KEY ("assignedSupportUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "SupportRequestMessage" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportRequestMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportRequestMessage_requestId_createdAt_idx" ON "SupportRequestMessage"("requestId", "createdAt");
ALTER TABLE "SupportRequestMessage" ADD CONSTRAINT "SupportRequestMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportRequestMessage" ADD CONSTRAINT "SupportRequestMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
