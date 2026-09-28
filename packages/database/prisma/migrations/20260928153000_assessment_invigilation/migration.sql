CREATE TABLE "AssessmentInvigilation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentInvigilation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssessmentInvigilation_sessionId_userId_key" ON "AssessmentInvigilation"("sessionId", "userId");
CREATE INDEX "AssessmentInvigilation_schoolId_userId_idx" ON "AssessmentInvigilation"("schoolId", "userId");
ALTER TABLE "AssessmentInvigilation" ADD CONSTRAINT "AssessmentInvigilation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentInvigilation" ADD CONSTRAINT "AssessmentInvigilation_sessionId_schoolId_fkey" FOREIGN KEY ("sessionId", "schoolId") REFERENCES "AssessmentSession"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentInvigilation" ADD CONSTRAINT "AssessmentInvigilation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentInvigilation" ADD CONSTRAINT "AssessmentInvigilation_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
