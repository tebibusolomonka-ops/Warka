CREATE TABLE "OperationalIncidentReview" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "impactSummary" TEXT NOT NULL,
  "rootCauseSummary" TEXT NOT NULL,
  "detectionNotes" TEXT NOT NULL,
  "responseNotes" TEXT NOT NULL,
  "followUpActions" JSONB NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedById" TEXT NOT NULL,
  CONSTRAINT "OperationalIncidentReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperationalIncidentReview_incidentId_key" ON "OperationalIncidentReview"("incidentId");
CREATE INDEX "OperationalIncidentReview_reviewedAt_idx" ON "OperationalIncidentReview"("reviewedAt");
ALTER TABLE "OperationalIncidentReview" ADD CONSTRAINT "OperationalIncidentReview_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "OperationalIncident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalIncidentReview" ADD CONSTRAINT "OperationalIncidentReview_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
