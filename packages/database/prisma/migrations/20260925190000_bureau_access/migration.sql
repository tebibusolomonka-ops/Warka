CREATE TYPE "BureauRole" AS ENUM ('viewer', 'reportManager');

CREATE TABLE "BureauAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "BureauRole" NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BureauAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BureauAccess_userId_organizationId_key" ON "BureauAccess"("userId", "organizationId");
CREATE INDEX "BureauAccess_organizationId_role_revokedAt_idx" ON "BureauAccess"("organizationId", "role", "revokedAt");
ALTER TABLE "BureauAccess" ADD CONSTRAINT "BureauAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BureauAccess" ADD CONSTRAINT "BureauAccess_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;