ALTER TYPE "ReportingSubmissionStatus" ADD VALUE 'underReview';
ALTER TABLE "ReportingSubmission" ADD COLUMN "acceptedVersion" INTEGER;

INSERT INTO "ReportingSubmissionVersion" ("id", "submissionId", "version", "snapshot", "validationSummary", "status", "submittedAt", "submittedById")
SELECT gen_random_uuid()::text, "id", 1, "snapshot", '{"warnings":[],"blocking":[]}'::jsonb, "status", "submittedAt", "submittedById"
FROM "ReportingSubmission"
WHERE "status" <> 'draft' AND "submittedById" IS NOT NULL AND "currentVersion" = 0;

UPDATE "ReportingSubmission" SET "currentVersion" = 1
WHERE "status" <> 'draft' AND "submittedById" IS NOT NULL AND "currentVersion" = 0;

UPDATE "ReportingSubmission" SET "acceptedVersion" = "currentVersion"
WHERE "status" = 'approved' AND "currentVersion" > 0;
