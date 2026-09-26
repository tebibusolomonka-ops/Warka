CREATE TABLE "SchoolDocumentProfile" (
    "schoolId" TEXT NOT NULL,
    "officialName" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "region" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "documentFooter" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SchoolDocumentProfile_pkey" PRIMARY KEY ("schoolId")
);

ALTER TABLE "SchoolDocumentProfile" ADD CONSTRAINT "SchoolDocumentProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
