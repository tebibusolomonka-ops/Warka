CREATE TYPE "BandwidthPreference" AS ENUM ('standard', 'lowBandwidth');
ALTER TABLE "User" ADD COLUMN "bandwidthPreference" "BandwidthPreference" NOT NULL DEFAULT 'standard';
