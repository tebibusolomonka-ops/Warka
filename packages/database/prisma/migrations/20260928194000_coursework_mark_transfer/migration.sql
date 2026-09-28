-- CreateTable
CREATE TABLE "CourseworkMarkTransfer" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "rubricScoreId" TEXT NOT NULL,
    "markId" TEXT NOT NULL,
    "scoreTransferred" DECIMAL(9,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseworkMarkTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseworkMarkTransfer_markId_key" ON "CourseworkMarkTransfer"("markId");

-- CreateIndex
CREATE INDEX "CourseworkMarkTransfer_schoolId_assignmentId_createdAt_idx" ON "CourseworkMarkTransfer"("schoolId", "assignmentId", "createdAt");

-- CreateIndex
CREATE INDEX "CourseworkMarkTransfer_revisionId_createdAt_idx" ON "CourseworkMarkTransfer"("revisionId", "createdAt");

-- AddForeignKey
ALTER TABLE "CourseworkMarkTransfer" ADD CONSTRAINT "CourseworkMarkTransfer_assignmentId_schoolId_fkey" FOREIGN KEY ("assignmentId", "schoolId") REFERENCES "CourseworkAssignment"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseworkMarkTransfer" ADD CONSTRAINT "CourseworkMarkTransfer_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "SubmissionRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseworkMarkTransfer" ADD CONSTRAINT "CourseworkMarkTransfer_rubricScoreId_fkey" FOREIGN KEY ("rubricScoreId") REFERENCES "RubricScore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseworkMarkTransfer" ADD CONSTRAINT "CourseworkMarkTransfer_markId_fkey" FOREIGN KEY ("markId") REFERENCES "Mark"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseworkMarkTransfer" ADD CONSTRAINT "CourseworkMarkTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
