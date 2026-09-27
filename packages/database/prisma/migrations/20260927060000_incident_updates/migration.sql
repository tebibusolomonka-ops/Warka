CREATE TABLE "OperationalIncidentUpdate" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "status" "OperationalIncidentStatus" NOT NULL,
  "message" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalIncidentUpdate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OperationalIncidentUpdate_incidentId_createdAt_idx" ON "OperationalIncidentUpdate"("incidentId", "createdAt");
ALTER TABLE "OperationalIncidentUpdate" ADD CONSTRAINT "OperationalIncidentUpdate_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "OperationalIncident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalIncidentUpdate" ADD CONSTRAINT "OperationalIncidentUpdate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
