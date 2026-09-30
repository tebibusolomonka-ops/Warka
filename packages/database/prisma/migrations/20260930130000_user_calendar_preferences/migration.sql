CREATE TYPE "CalendarPreference" AS ENUM ('gregorian', 'ethiopian');

ALTER TABLE "User"
ADD COLUMN "preferredCalendar" "CalendarPreference" NOT NULL DEFAULT 'gregorian';
