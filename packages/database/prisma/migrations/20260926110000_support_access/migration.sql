CREATE TYPE "SupportAccessStatus" AS ENUM ('pending', 'approved', 'revoked');
CREATE TYPE "SupportAccessScope" AS ENUM ('schoolAdministrationDiagnostics');

CREATE TABLE "SupportIdentity" (
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportIdentity_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "SupportAccessGrant" (
    "id" TEXT NOT NULL,
    "supportUserId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "scope" "SupportAccessScope" NOT NULL DEFAULT 'schoolAdministrationDiagnostics',
    "reason" TEXT NOT NULL,
    "status" "SupportAccessStatus" NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    CONSTRAINT "SupportAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportAccessGrant_supportUserId_schoolId_status_expiresAt_idx" ON "SupportAccessGrant"("supportUserId", "schoolId", "status", "expiresAt");
CREATE INDEX "SupportAccessGrant_schoolId_status_requestedAt_idx" ON "SupportAccessGrant"("schoolId", "status", "requestedAt");
ALTER TABLE "SupportIdentity" ADD CONSTRAINT "SupportIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;