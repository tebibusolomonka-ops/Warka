CREATE TYPE "PreferredLocale" AS ENUM ('en', 'am', 'om');

ALTER TABLE "User"
ADD COLUMN "preferredLocale" "PreferredLocale" NOT NULL DEFAULT 'en';
