ALTER TABLE "Notification" ADD COLUMN "emailRoutedAt" TIMESTAMP(3);
UPDATE "Notification" SET "emailRoutedAt" = CURRENT_TIMESTAMP;
CREATE INDEX "Notification_emailRoutedAt_createdAt_idx" ON "Notification"("emailRoutedAt", "createdAt");
ALTER TABLE "EmailDelivery" ADD COLUMN "notificationId" TEXT;
CREATE UNIQUE INDEX "EmailDelivery_notificationId_key" ON "EmailDelivery"("notificationId");
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
