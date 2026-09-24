CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "School_organizationId_idx" ON "School"("organizationId");

ALTER TABLE "School" ADD CONSTRAINT "School_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
