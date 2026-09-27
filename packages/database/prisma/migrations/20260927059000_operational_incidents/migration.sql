CREATE TYPE "OperationalIncidentSeverity" AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE "OperationalIncidentStatus" AS ENUM ('open', 'investigating', 'monitoring', 'resolved');
CREATE TABLE "OperationalIncident" (
  "id" TEXT NOT NULL,
  "severity" "OperationalIncidentSeverity" NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "status" "OperationalIncidentStatus" NOT NULL DEFAULT 'open',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "resolvedById" TEXT,
  CONSTRAINT "OperationalIncident_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OperationalIncident_status_startedAt_idx" ON "OperationalIncident"("status", "startedAt");
CREATE INDEX "OperationalIncident_severity_startedAt_idx" ON "OperationalIncident"("severity", "startedAt");
ALTER TABLE "OperationalIncident" ADD CONSTRAINT "OperationalIncident_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalIncident" ADD CONSTRAINT "OperationalIncident_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
