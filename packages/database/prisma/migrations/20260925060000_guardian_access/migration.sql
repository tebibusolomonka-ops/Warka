CREATE TABLE "GuardianAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuardianAccess_userId_key" ON "GuardianAccess"("userId");

CREATE UNIQUE INDEX "GuardianAccess_guardianId_key" ON "GuardianAccess"("guardianId");

ALTER TABLE "GuardianAccess" ADD CONSTRAINT "GuardianAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuardianAccess" ADD CONSTRAINT "GuardianAccess_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

