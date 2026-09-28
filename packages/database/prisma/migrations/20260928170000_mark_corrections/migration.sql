CREATE TABLE "MarkCorrection" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "markId" TEXT NOT NULL,
    "moderationRequestId" TEXT NOT NULL,
    "previousScore" DECIMAL(8,2) NOT NULL,
    "newScore" DECIMAL(8,2) NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarkCorrection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarkCorrection_moderationRequestId_key" ON "MarkCorrection"("moderationRequestId");
CREATE INDEX "MarkCorrection_schoolId_markId_effectiveAt_idx" ON "MarkCorrection"("schoolId", "markId", "effectiveAt");
ALTER TABLE "MarkCorrection" ADD CONSTRAINT "MarkCorrection_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarkCorrection" ADD CONSTRAINT "MarkCorrection_markId_fkey" FOREIGN KEY ("markId") REFERENCES "Mark"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarkCorrection" ADD CONSTRAINT "MarkCorrection_moderationRequestId_fkey" FOREIGN KEY ("moderationRequestId") REFERENCES "MarkModerationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarkCorrection" ADD CONSTRAINT "MarkCorrection_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
