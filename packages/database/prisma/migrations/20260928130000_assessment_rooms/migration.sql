CREATE TABLE "AssessmentRoom" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "capacity" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssessmentRoom_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AssessmentRoom_capacity_check" CHECK ("capacity" IS NULL OR "capacity" > 0)
);

CREATE UNIQUE INDEX "AssessmentRoom_schoolId_name_key" ON "AssessmentRoom"("schoolId", "name");
CREATE UNIQUE INDEX "AssessmentRoom_schoolId_code_key" ON "AssessmentRoom"("schoolId", "code");
CREATE UNIQUE INDEX "AssessmentRoom_id_schoolId_key" ON "AssessmentRoom"("id", "schoolId");
CREATE INDEX "AssessmentRoom_schoolId_active_idx" ON "AssessmentRoom"("schoolId", "active");
ALTER TABLE "AssessmentRoom" ADD CONSTRAINT "AssessmentRoom_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
