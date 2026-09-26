CREATE TYPE "TrainingType" AS ENUM ('schoolAdministration', 'studentRegistration', 'academicResults', 'documentProcessing');
CREATE TYPE "TrainingStatus" AS ENUM ('assigned', 'completed', 'waived');
CREATE TABLE "TrainingRecord" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "trainingType" "TrainingType" NOT NULL,
  "status" "TrainingStatus" NOT NULL DEFAULT 'assigned',
  "completedAt" TIMESTAMP(3),
  "recordedById" TEXT NOT NULL,
  "waiverReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TrainingRecord_schoolId_userId_trainingType_key" ON "TrainingRecord"("schoolId", "userId", "trainingType");
CREATE INDEX "TrainingRecord_schoolId_status_idx" ON "TrainingRecord"("schoolId", "status");
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
