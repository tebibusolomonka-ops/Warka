-- CreateTable
CREATE TABLE "CourseworkRubric" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "createdById" TEXT NOT NULL,
    "frozenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseworkRubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricCriterion" (
    "id" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "maxPoints" DECIMAL(7,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "RubricCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseworkRubric_schoolId_createdAt_idx" ON "CourseworkRubric"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourseworkRubric_assignmentId_schoolId_key" ON "CourseworkRubric"("assignmentId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "RubricCriterion_rubricId_sortOrder_key" ON "RubricCriterion"("rubricId", "sortOrder");

-- AddForeignKey
ALTER TABLE "CourseworkRubric" ADD CONSTRAINT "CourseworkRubric_assignmentId_schoolId_fkey" FOREIGN KEY ("assignmentId", "schoolId") REFERENCES "CourseworkAssignment"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseworkRubric" ADD CONSTRAINT "CourseworkRubric_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricCriterion" ADD CONSTRAINT "RubricCriterion_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "CourseworkRubric"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
