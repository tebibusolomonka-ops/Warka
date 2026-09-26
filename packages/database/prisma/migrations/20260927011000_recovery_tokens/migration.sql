ALTER TABLE "AccountRecoveryRequest" ADD COLUMN "tokenHash" TEXT;
CREATE UNIQUE INDEX "AccountRecoveryRequest_tokenHash_key" ON "AccountRecoveryRequest"("tokenHash");
