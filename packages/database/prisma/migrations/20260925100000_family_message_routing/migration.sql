CREATE TYPE "FamilySenderKind" AS ENUM ('guardian', 'school');

ALTER TABLE "FamilyConversation" ADD COLUMN     "escalatedAt" TIMESTAMP(3),
ADD COLUMN     "escalatedById" TEXT;

ALTER TABLE "FamilyMessage" ADD COLUMN     "senderKind" "FamilySenderKind" NOT NULL DEFAULT 'guardian';

ALTER TABLE "FamilyConversation" ADD CONSTRAINT "FamilyConversation_escalatedById_fkey" FOREIGN KEY ("escalatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
