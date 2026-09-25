CREATE TYPE "DocumentType" AS ENUM ('reportCard', 'transcript');

CREATE TYPE "DocumentStatus" AS ENUM ('active', 'corrected', 'withdrawn');

CREATE TABLE "IssuedDocument" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "verificationReference" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'active',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssuedDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IssuedDocument_verificationReference_key" ON "IssuedDocument"("verificationReference");

CREATE INDEX "IssuedDocument_schoolId_studentId_issuedAt_idx" ON "IssuedDocument"("schoolId", "studentId", "issuedAt");

CREATE INDEX "IssuedDocument_schoolId_issuedAt_idx" ON "IssuedDocument"("schoolId", "issuedAt");

ALTER TABLE "IssuedDocument" ADD CONSTRAINT "IssuedDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IssuedDocument" ADD CONSTRAINT "IssuedDocument_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IssuedDocument" ADD CONSTRAINT "IssuedDocument_academicYearId_schoolId_fkey" FOREIGN KEY ("academicYearId", "schoolId") REFERENCES "AcademicYear"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IssuedDocument" ADD CONSTRAINT "IssuedDocument_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
