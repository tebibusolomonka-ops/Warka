CREATE TABLE "GradingScheme" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradingScheme_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GradeBand" (
    "id" TEXT NOT NULL,
    "gradingSchemeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minimumPercentage" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "GradeBand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GradingScheme_schoolId_key" ON "GradingScheme"("schoolId");

CREATE INDEX "GradeBand_gradingSchemeId_minimumPercentage_idx" ON "GradeBand"("gradingSchemeId", "minimumPercentage");

CREATE UNIQUE INDEX "GradeBand_gradingSchemeId_label_key" ON "GradeBand"("gradingSchemeId", "label");

CREATE UNIQUE INDEX "GradeBand_gradingSchemeId_minimumPercentage_key" ON "GradeBand"("gradingSchemeId", "minimumPercentage");

ALTER TABLE "GradingScheme" ADD CONSTRAINT "GradingScheme_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GradeBand" ADD CONSTRAINT "GradeBand_gradingSchemeId_fkey" FOREIGN KEY ("gradingSchemeId") REFERENCES "GradingScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
