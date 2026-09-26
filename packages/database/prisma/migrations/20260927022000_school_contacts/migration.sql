CREATE TYPE "SchoolContactRole" AS ENUM ('primary', 'technical', 'records', 'emergency');
CREATE TABLE "SchoolContact" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "SchoolContactRole" NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolContact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SchoolContact_schoolId_role_idx" ON "SchoolContact"("schoolId", "role");
ALTER TABLE "SchoolContact" ADD CONSTRAINT "SchoolContact_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
