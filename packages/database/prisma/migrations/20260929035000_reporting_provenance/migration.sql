CREATE TYPE "ReportingVersionProvenance" AS ENUM ('nativeVersion', 'legacyBackfill');
CREATE TYPE "ReportingVersionIntegrity" AS ENUM ('verified', 'legacyUnverified');

ALTER TABLE "ReportingSubmissionVersion"
  ADD COLUMN "provenance" "ReportingVersionProvenance" NOT NULL DEFAULT 'nativeVersion',
  ADD COLUMN "integrityState" "ReportingVersionIntegrity" NOT NULL DEFAULT 'verified';

UPDATE "ReportingSubmissionVersion"
SET "provenance" = 'legacyBackfill', "integrityState" = 'legacyUnverified'
WHERE "snapshotChecksum" IS NULL;

ALTER TABLE "ReportingSubmissionVersion"
  ADD CONSTRAINT "ReportingSubmissionVersion_provenance_integrity_check"
  CHECK (
    ("provenance" = 'nativeVersion' AND "integrityState" = 'verified' AND "snapshotChecksum" IS NOT NULL)
    OR
    ("provenance" = 'legacyBackfill' AND "integrityState" = 'legacyUnverified' AND "snapshotChecksum" IS NULL)
  );
