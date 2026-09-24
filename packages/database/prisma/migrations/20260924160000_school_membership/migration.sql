CREATE TYPE "SchoolRole" AS ENUM ('administrator', 'registrar', 'teacher', 'approver');

CREATE TABLE "SchoolMembership" (
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "role" "SchoolRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolMembership_pkey" PRIMARY KEY ("userId","schoolId")
);

CREATE INDEX "SchoolMembership_schoolId_idx" ON "SchoolMembership"("schoolId");

ALTER TABLE "SchoolMembership" ADD CONSTRAINT "SchoolMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SchoolMembership" ADD CONSTRAINT "SchoolMembership_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
