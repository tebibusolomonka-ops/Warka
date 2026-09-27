CREATE TYPE "AccountStatus" AS ENUM ('active', 'suspended', 'deactivated');
ALTER TABLE "User" ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'active';
