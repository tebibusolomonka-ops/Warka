CREATE TYPE "SchoolEventAudienceScope" AS ENUM ('wholeSchool', 'students', 'guardians', 'staff', 'grade', 'class');

CREATE TABLE "SchoolEventAudience" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "scope" "SchoolEventAudienceScope" NOT NULL,
    "gradeLevelId" TEXT,
    "schoolClassId" TEXT,
    CONSTRAINT "SchoolEventAudience_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SchoolEventAudience_scope_check" CHECK (
      ("scope" = 'grade' AND "gradeLevelId" IS NOT NULL AND "schoolClassId" IS NULL) OR
      ("scope" = 'class' AND "schoolClassId" IS NOT NULL AND "gradeLevelId" IS NULL) OR
      ("scope" NOT IN ('grade', 'class') AND "gradeLevelId" IS NULL AND "schoolClassId" IS NULL)
    )
);

CREATE UNIQUE INDEX "SchoolEventAudience_eventId_key" ON "SchoolEventAudience"("eventId");
CREATE UNIQUE INDEX "SchoolEventAudience_eventId_schoolId_key" ON "SchoolEventAudience"("eventId", "schoolId");
CREATE INDEX "SchoolEventAudience_schoolId_scope_idx" ON "SchoolEventAudience"("schoolId", "scope");
ALTER TABLE "SchoolEventAudience" ADD CONSTRAINT "SchoolEventAudience_eventId_schoolId_fkey" FOREIGN KEY ("eventId", "schoolId") REFERENCES "SchoolEvent"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchoolEventAudience" ADD CONSTRAINT "SchoolEventAudience_gradeLevelId_schoolId_fkey" FOREIGN KEY ("gradeLevelId", "schoolId") REFERENCES "GradeLevel"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchoolEventAudience" ADD CONSTRAINT "SchoolEventAudience_schoolClassId_schoolId_fkey" FOREIGN KEY ("schoolClassId", "schoolId") REFERENCES "SchoolClass"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;
