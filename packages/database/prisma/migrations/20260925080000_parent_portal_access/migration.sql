CREATE TABLE "SchoolServiceAccess" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "parentPortalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolServiceAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolServiceAccess_schoolId_key" ON "SchoolServiceAccess"("schoolId");

ALTER TABLE "SchoolServiceAccess" ADD CONSTRAINT "SchoolServiceAccess_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SchoolServiceAccess" ADD CONSTRAINT "SchoolServiceAccess_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
