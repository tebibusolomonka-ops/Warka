CREATE TYPE "MaintenanceWindowStatus" AS ENUM ('scheduled', 'inProgress', 'completed', 'cancelled');
CREATE TABLE "MaintenanceWindow" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "MaintenanceWindowStatus" NOT NULL DEFAULT 'scheduled',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenanceWindow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaintenanceWindow_status_startsAt_idx" ON "MaintenanceWindow"("status", "startsAt");
ALTER TABLE "MaintenanceWindow" ADD CONSTRAINT "MaintenanceWindow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
