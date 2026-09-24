import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const databaseUrlSchema = z
  .url()
  .refine(
    (value) =>
      value.startsWith('postgresql://') || value.startsWith('postgres://'),
    'DATABASE_URL must use PostgreSQL',
  )

export function createDatabaseClient(
  env: NodeJS.ProcessEnv = process.env,
): PrismaClient {
  const result = databaseUrlSchema.safeParse(env.DATABASE_URL)
  if (!result.success) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL')
  }

  return new PrismaClient({ datasourceUrl: result.data })
}

export type { PrismaClient }
export { createOrganization, findOrganizationById } from './organizations.js'
export type { CreateOrganization } from './organizations.js'
export {
  createSchool,
  findSchoolById,
  listSchoolsForOrganization,
} from './schools.js'
export type { CreateSchool } from './schools.js'
export type { Organization, School } from '@prisma/client'
export {
  createUser,
  findUserById,
  findUserByEmail,
  normalizeEmail,
  DuplicateEmailError,
} from './users.js'
export type { CreateUser } from './users.js'
export type { User } from '@prisma/client'
export {
  OrganizationRoleSchema,
  createOrganizationMembership,
  findOrganizationMembership,
  listOrganizationsForUser,
  hasOrganizationAdminRole,
  DuplicateOrganizationMembershipError,
} from './organizationMemberships.js'
export type {
  CreateOrganizationMembership,
  OrganizationAccess,
} from './organizationMemberships.js'
export type { OrganizationMembership, OrganizationRole } from '@prisma/client'
export {
  SchoolRoleSchema,
  assignUserToSchool,
  findSchoolMembership,
  listSchoolAssignmentsForUser,
  listStaffAssignmentsForSchool,
  hasSchoolRole,
  DuplicateSchoolMembershipError,
} from './schoolMemberships.js'
export type {
  CreateSchoolMembership,
  SchoolAssignment,
  StaffAssignment,
} from './schoolMemberships.js'
export type { SchoolMembership, SchoolRole } from '@prisma/client'
export {
  savePasswordHash,
  findPasswordHashForUser,
} from './passwordCredentials.js'
export {
  createSessionRecord,
  findSessionByHash,
  revokeSessionByHash,
  revokeSessionsForUser,
} from './sessions.js'
export type { CreateSessionRecord } from './sessions.js'
export type { Session } from '@prisma/client'

export {
  CreateAcademicYearSchema,
  DuplicateAcademicYearError,
  createAcademicYear,
  findAcademicYearById,
  listAcademicYearsForSchool,
} from './academicYears.js'
export type { CreateAcademicYear } from './academicYears.js'
export type { AcademicYear } from '@prisma/client'

export {
  CreateGradeLevelSchema,
  DuplicateGradeLevelError,
  createGradeLevel,
  listGradeLevelsForSchool,
} from './gradeLevels.js'
export type { CreateGradeLevel } from './gradeLevels.js'
export type { GradeLevel } from '@prisma/client'
export {
  CreateSchoolClassSchema,
  DuplicateSchoolClassError,
  InvalidClassStructureError,
  createSchoolClass,
  findSchoolClassById,
  listClassesForAcademicYear,
} from './schoolClasses.js'
export type { CreateSchoolClass } from './schoolClasses.js'
export type { SchoolClass } from '@prisma/client'

export {
  CreateStudentSchema,
  createStudent,
  findStudentById,
  findStudentByReference,
  generateStudentReference,
} from './students.js'
export type { CreateStudent } from './students.js'
export type { Student } from '@prisma/client'

export {
  CreateGuardianSchema,
  LinkGuardianSchema,
  DuplicateGuardianLinkError,
  createGuardian,
  linkGuardianToStudent,
  listGuardiansForStudent,
  listStudentsForGuardian,
} from './guardians.js'
export type {
  CreateGuardian,
  LinkGuardian,
  GuardianForStudent,
  StudentForGuardian,
} from './guardians.js'
export type { Guardian, StudentGuardian } from '@prisma/client'

export {
  CreateEnrollmentSchema,
  InvalidEnrollmentStructureError,
  DuplicateEnrollmentError,
  EnrollmentNotFoundError,
  InvalidEnrollmentTransitionError,
  canTransition,
  createEnrollment,
  findEnrollmentById,
  submitEnrollment,
  approveEnrollment,
  withdrawEnrollment,
} from './enrollments.js'
export type { CreateEnrollment, EnrollmentAction } from './enrollments.js'
export type { Enrollment, EnrollmentStatus } from '@prisma/client'

export {
  findPossibleDuplicates,
  registerStudentRecord,
} from './studentRegistration.js'
export type {
  PossibleDuplicate,
  StudentRegistration,
} from './studentRegistration.js'

export {
  CreateSubjectSchema,
  DuplicateSubjectError,
  createSubject,
  findSubjectById,
  listSubjectsForSchool,
} from './subjects.js'
export type { CreateSubject } from './subjects.js'
export type { Subject } from '@prisma/client'

export {
  AssignTeacherSchema,
  InvalidTeachingAssignmentError,
  DuplicateTeachingAssignmentError,
  assignTeacher,
  removeTeachingAssignment,
  listTeacherAssignments,
  listClassSubjectAssignments,
  mayManageClassSubject,
} from './teachingAssignments.js'
export type { AssignTeacher } from './teachingAssignments.js'
export type { TeachingAssignment } from '@prisma/client'

export {
  CreateGradingPeriodSchema,
  InvalidGradingPeriodError,
  DuplicateGradingPeriodError,
  createGradingPeriod,
  findGradingPeriodById,
  listGradingPeriods,
} from './gradingPeriods.js'
export type { CreateGradingPeriod } from './gradingPeriods.js'
export type { GradingPeriod } from '@prisma/client'

export {
  CreateAssessmentSchema,
  InvalidAssessmentContextError,
  DuplicateAssessmentError,
  assessmentConfiguration,
  createAssessment,
  findAssessmentById,
  listAssessments,
} from './assessments.js'
export type { CreateAssessment } from './assessments.js'
export type { Assessment } from '@prisma/client'
