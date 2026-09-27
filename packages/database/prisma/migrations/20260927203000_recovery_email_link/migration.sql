ALTER TABLE "EmailDelivery" ADD COLUMN "recoveryRequestId" TEXT;
CREATE UNIQUE INDEX "EmailDelivery_recoveryRequestId_key" ON "EmailDelivery"("recoveryRequestId");
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_recoveryRequestId_fkey" FOREIGN KEY ("recoveryRequestId") REFERENCES "AccountRecoveryRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
