CREATE TYPE "PilotReadinessStatus" AS ENUM ('planned', 'preparing', 'ready', 'active', 'paused', 'completed');
CREATE TABLE "PilotReadiness" (
  "id" TEXT NOT NULL, "schoolId" TEXT NOT NULL, "status" "PilotReadinessStatus" NOT NULL DEFAULT 'planned',
  "primaryContactConfirmed" BOOLEAN NOT NULL DEFAULT false, "supportContactConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "academicYearConfigured" BOOLEAN NOT NULL DEFAULT false, "schoolStructureConfigured" BOOLEAN NOT NULL DEFAULT false,
  "staffAccessPrepared" BOOLEAN NOT NULL DEFAULT false, "dataPreparationState" TEXT NOT NULL DEFAULT 'notStarted',
  "trainingState" TEXT NOT NULL DEFAULT 'notStarted', "goLiveStartsAt" TIMESTAMP(3), "goLiveEndsAt" TIMESTAMP(3),
  "supportCoverageState" TEXT NOT NULL DEFAULT 'notConfirmed', "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PilotReadiness_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PilotReadiness_schoolId_key" ON "PilotReadiness"("schoolId");
CREATE INDEX "PilotReadiness_status_createdAt_idx" ON "PilotReadiness"("status", "createdAt");
CREATE TABLE "PilotReadinessTransition" (
  "id" TEXT NOT NULL, "pilotReadinessId" TEXT NOT NULL, "fromStatus" "PilotReadinessStatus", "toStatus" "PilotReadinessStatus" NOT NULL,
  "reason" TEXT NOT NULL, "actorId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PilotReadinessTransition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PilotReadinessTransition_pilotReadinessId_createdAt_idx" ON "PilotReadinessTransition"("pilotReadinessId", "createdAt");
ALTER TABLE "PilotReadiness" ADD CONSTRAINT "PilotReadiness_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PilotReadiness" ADD CONSTRAINT "PilotReadiness_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PilotReadinessTransition" ADD CONSTRAINT "PilotReadinessTransition_pilotReadinessId_fkey" FOREIGN KEY ("pilotReadinessId") REFERENCES "PilotReadiness"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PilotReadinessTransition" ADD CONSTRAINT "PilotReadinessTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
