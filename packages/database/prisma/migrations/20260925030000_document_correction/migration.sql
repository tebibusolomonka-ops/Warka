ALTER TABLE "IssuedDocument" ADD COLUMN     "correctedAt" TIMESTAMP(3),
ADD COLUMN     "correctedById" TEXT,
ADD COLUMN     "correctionReason" TEXT,
ADD COLUMN     "supersedesId" TEXT,
ADD COLUMN     "withdrawalReason" TEXT,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3),
ADD COLUMN     "withdrawnById" TEXT;

CREATE UNIQUE INDEX "IssuedDocument_supersedesId_key" ON "IssuedDocument"("supersedesId");

ALTER TABLE "IssuedDocument" ADD CONSTRAINT "IssuedDocument_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IssuedDocument" ADD CONSTRAINT "IssuedDocument_withdrawnById_fkey" FOREIGN KEY ("withdrawnById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IssuedDocument" ADD CONSTRAINT "IssuedDocument_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "IssuedDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
