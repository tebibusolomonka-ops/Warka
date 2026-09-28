-- CreateTable
CREATE TABLE "RubricScore" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "totalPoints" DECIMAL(9,2) NOT NULL,
    "scoredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RubricScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricCriterionScore" (
    "id" TEXT NOT NULL,
    "scoreId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "points" DECIMAL(7,2) NOT NULL,

    CONSTRAINT "RubricCriterionScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RubricScore_rubricId_createdAt_idx" ON "RubricScore"("rubricId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RubricScore_revisionId_version_key" ON "RubricScore"("revisionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RubricCriterionScore_scoreId_criterionId_key" ON "RubricCriterionScore"("scoreId", "criterionId");

-- AddForeignKey
ALTER TABLE "RubricScore" ADD CONSTRAINT "RubricScore_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "SubmissionRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricScore" ADD CONSTRAINT "RubricScore_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "CourseworkRubric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricScore" ADD CONSTRAINT "RubricScore_scoredById_fkey" FOREIGN KEY ("scoredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricCriterionScore" ADD CONSTRAINT "RubricCriterionScore_scoreId_fkey" FOREIGN KEY ("scoreId") REFERENCES "RubricScore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricCriterionScore" ADD CONSTRAINT "RubricCriterionScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "RubricCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
