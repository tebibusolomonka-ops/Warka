CREATE TYPE "SchoolOnboardingStatus" AS ENUM ('notStarted', 'inProgress', 'readyForReview', 'completed', 'paused');
CREATE TABLE "SchoolOnboarding" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "status" "SchoolOnboardingStatus" NOT NULL DEFAULT 'notStarted',
  "startedAt" TIMESTAMP(3),
  "startedById" TEXT,
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  CONSTRAINT "SchoolOnboarding_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SchoolOnboarding_schoolId_key" ON "SchoolOnboarding"("schoolId");
ALTER TABLE "SchoolOnboarding" ADD CONSTRAINT "SchoolOnboarding_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SchoolOnboarding" ADD CONSTRAINT "SchoolOnboarding_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SchoolOnboarding" ADD CONSTRAINT "SchoolOnboarding_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
