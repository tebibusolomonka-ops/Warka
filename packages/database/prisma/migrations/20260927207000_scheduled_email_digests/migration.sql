CREATE TYPE "DigestCadence" AS ENUM ('off', 'daily', 'weekly');
ALTER TABLE "NotificationPreference" ADD COLUMN "digestCadence" "DigestCadence" NOT NULL DEFAULT 'off';
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_digest_check" CHECK (
  "digestCadence" = 'off' OR
  ("emailEnabled" = true AND "category" IN ('academicResults', 'schoolAnnouncements', 'learningMaterials'))
);
ALTER TABLE "EmailDelivery" ADD COLUMN "digestId" TEXT;
CREATE UNIQUE INDEX "EmailDelivery_digestId_key" ON "EmailDelivery"("digestId");
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_digestId_fkey" FOREIGN KEY ("digestId") REFERENCES "EmailDigest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
