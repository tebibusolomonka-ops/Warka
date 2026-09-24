CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "studentReference" TEXT NOT NULL,
    "givenName" TEXT NOT NULL,
    "familyName" TEXT,
    "dateOfBirth" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Student_studentReference_key" ON "Student"("studentReference");
