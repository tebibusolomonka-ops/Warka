CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Student_studentReference_trgm_idx" ON "Student" USING GIN ("studentReference" gin_trgm_ops);
CREATE INDEX "Student_givenName_trgm_idx" ON "Student" USING GIN ("givenName" gin_trgm_ops);
CREATE INDEX "Student_familyName_trgm_idx" ON "Student" USING GIN ("familyName" gin_trgm_ops);
