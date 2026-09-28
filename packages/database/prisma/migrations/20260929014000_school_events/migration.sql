CREATE TYPE "SchoolEventStatus" AS ENUM ('draft', 'published', 'cancelled', 'completed');

CREATE TABLE "SchoolEvent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "schoolLocation" VARCHAR(200),
    "status" "SchoolEventStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SchoolEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolEvent_id_schoolId_key" ON "SchoolEvent"("id", "schoolId");
CREATE INDEX "SchoolEvent_schoolId_status_startsAt_idx" ON "SchoolEvent"("schoolId", "status", "startsAt");
ALTER TABLE "SchoolEvent" ADD CONSTRAINT "SchoolEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchoolEvent" ADD CONSTRAINT "SchoolEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
