CREATE TYPE "OnboardingChecklistStatus" AS ENUM ('pending', 'complete', 'notApplicable');
CREATE TABLE "OnboardingChecklistItem" (
  "id" TEXT NOT NULL,
  "onboardingId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "status" "OnboardingChecklistStatus" NOT NULL DEFAULT 'pending',
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  CONSTRAINT "OnboardingChecklistItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OnboardingChecklistItem_onboardingId_key_key" ON "OnboardingChecklistItem"("onboardingId", "key");
ALTER TABLE "OnboardingChecklistItem" ADD CONSTRAINT "OnboardingChecklistItem_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "SchoolOnboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingChecklistItem" ADD CONSTRAINT "OnboardingChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
