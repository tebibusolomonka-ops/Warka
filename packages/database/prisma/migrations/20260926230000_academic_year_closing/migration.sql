CREATE TYPE "AcademicYearStatus" AS ENUM ('active', 'closing', 'closed');
ALTER TABLE "AcademicYear" ADD COLUMN "status" "AcademicYearStatus" NOT NULL DEFAULT 'active', ADD COLUMN "closingStartedAt" TIMESTAMP(3), ADD COLUMN "closedAt" TIMESTAMP(3), ADD COLUMN "closedById" TEXT;
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AcademicYear_schoolId_status_idx" ON "AcademicYear"("schoolId", "status");
