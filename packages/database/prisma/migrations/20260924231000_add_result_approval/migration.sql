CREATE TYPE "ResultSetStatus" AS ENUM ('draft', 'pending', 'published');

CREATE TABLE "ResultSet" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "gradingPeriodId" TEXT NOT NULL,
    "schoolClassId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "status" "ResultSetStatus" NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PublishedResult" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "resultSetId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "gradeLabel" TEXT NOT NULL,
    "currentPercentage" DECIMAL(5,2) NOT NULL,
    "currentGradeLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishedResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResultCorrection" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "publishedResultId" TEXT NOT NULL,
    "previousPercentage" DECIMAL(5,2) NOT NULL,
    "previousGradeLabel" TEXT NOT NULL,
    "newPercentage" DECIMAL(5,2) NOT NULL,
    "newGradeLabel" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultCorrection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ResultSet_schoolId_status_idx" ON "ResultSet"("schoolId", "status");

CREATE UNIQUE INDEX "ResultSet_context_key" ON "ResultSet"("schoolId", "academicYearId", "gradingPeriodId", "schoolClassId", "subjectId");

CREATE UNIQUE INDEX "ResultSet_id_schoolId_key" ON "ResultSet"("id", "schoolId");

CREATE INDEX "PublishedResult_schoolId_studentId_idx" ON "PublishedResult"("schoolId", "studentId");

CREATE UNIQUE INDEX "PublishedResult_resultSetId_enrollmentId_key" ON "PublishedResult"("resultSetId", "enrollmentId");

CREATE UNIQUE INDEX "PublishedResult_id_schoolId_key" ON "PublishedResult"("id", "schoolId");

CREATE INDEX "ResultCorrection_schoolId_publishedResultId_effectiveAt_idx" ON "ResultCorrection"("schoolId", "publishedResultId", "effectiveAt");

ALTER TABLE "ResultSet" ADD CONSTRAINT "ResultSet_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResultSet" ADD CONSTRAINT "ResultSet_academicYearId_schoolId_fkey" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResultSet" ADD CONSTRAINT "ResultSet_gradingPeriodId_schoolId_academicYearId_fkey" FOREIGN KEY ("gradingPeriodId", "schoolId", "academicYearId") REFERENCES "GradingPeriod"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResultSet" ADD CONSTRAINT "ResultSet_schoolClassId_schoolId_academicYearId_fkey" FOREIGN KEY ("schoolClassId", "schoolId", "academicYearId") REFERENCES "SchoolClass"("id", "schoolId", "academicYearId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResultSet" ADD CONSTRAINT "ResultSet_subjectId_schoolId_fkey" FOREIGN KEY ("subjectId", "schoolId") REFERENCES "Subject"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResultSet" ADD CONSTRAINT "ResultSet_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResultSet" ADD CONSTRAINT "ResultSet_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PublishedResult" ADD CONSTRAINT "PublishedResult_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PublishedResult" ADD CONSTRAINT "PublishedResult_resultSetId_schoolId_fkey" FOREIGN KEY ("resultSetId", "schoolId") REFERENCES "ResultSet"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PublishedResult" ADD CONSTRAINT "PublishedResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PublishedResult" ADD CONSTRAINT "PublishedResult_enrollmentId_schoolId_studentId_fkey" FOREIGN KEY ("enrollmentId", "schoolId", "studentId") REFERENCES "Enrollment"("id", "schoolId", "studentId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResultCorrection" ADD CONSTRAINT "ResultCorrection_publishedResultId_schoolId_fkey" FOREIGN KEY ("publishedResultId", "schoolId") REFERENCES "PublishedResult"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResultCorrection" ADD CONSTRAINT "ResultCorrection_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
