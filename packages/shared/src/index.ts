import { z } from 'zod'

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
})

export type HealthResponse = z.infer<typeof HealthResponseSchema>

export const NameSchema = z.string().trim().min(1).max(200)

export const CreateSchoolSchema = z.object({
  name: NameSchema,
})

export const OrganizationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const SchoolSchema = OrganizationSchema.extend({
  organizationId: z.uuid(),
})

export const SchoolsResponseSchema = z.array(SchoolSchema)

export const StudentCapabilitiesSchema = z.object({
  canRegister: z.boolean(),
  canSubmit: z.boolean(),
  canApprove: z.boolean(),
})

export const AccessibleSchoolSchema = z.object({
  school: SchoolSchema,
  capabilities: StudentCapabilitiesSchema,
})

export const AccessibleSchoolsResponseSchema = z.array(AccessibleSchoolSchema)

export type AccessibleSchool = z.infer<typeof AccessibleSchoolSchema>

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

export type Organization = z.infer<typeof OrganizationSchema>
export type School = z.infer<typeof SchoolSchema>

export const LoginCredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(1024),
})

export type LoginCredentials = z.infer<typeof LoginCredentialsSchema>

export const UserIdentitySchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string(),
})

export type UserIdentity = z.infer<typeof UserIdentitySchema>

export const OrganizationAccessSchema = z.object({
  organization: OrganizationSchema,
  role: z.enum(['owner', 'administrator']),
})

export const OrganizationsResponseSchema = z.array(OrganizationAccessSchema)

export type OrganizationAccess = z.infer<typeof OrganizationAccessSchema>

export const AcademicYearOptionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
})

export const GradeLevelOptionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
})

export const SchoolClassOptionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  gradeLevelId: z.uuid(),
  academicYearId: z.uuid(),
})

export const StudentOptionsSchema = z.object({
  academicYears: z.array(AcademicYearOptionSchema),
  gradeLevels: z.array(GradeLevelOptionSchema),
  classes: z.array(SchoolClassOptionSchema),
})

export type StudentOptions = z.infer<typeof StudentOptionsSchema>

export const StudentSchema = z.object({
  id: z.uuid(),
  studentReference: z.string(),
  givenName: z.string(),
  familyName: z.string().nullable(),
  dateOfBirth: z.iso.date().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const EnrollmentSchema = z.object({
  id: z.uuid(),
  studentId: z.uuid(),
  schoolId: z.uuid(),
  academicYearId: z.uuid(),
  gradeLevelId: z.uuid(),
  schoolClassId: z.uuid().nullable(),
  status: z.enum(['draft', 'pending', 'approved', 'withdrawn']),
  approvedAt: z.iso.datetime().nullable(),
  approvedById: z.uuid().nullable(),
  withdrawnAt: z.iso.datetime().nullable(),
  withdrawnById: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const GuardianSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const GuardianLinkSchema = z.object({
  guardian: GuardianSchema,
  relationship: z.string(),
})

export const StudentInputSchema = z.strictObject({
  givenName: z.string().trim().min(1).max(100),
  familyName: z.string().trim().min(1).max(100).optional(),
  dateOfBirth: z.iso.date().optional(),
})

export const RegistrationGuardianSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(1).max(40).optional(),
  email: z.string().trim().toLowerCase().pipe(z.email()).optional(),
  relationship: z.string().trim().min(1).max(100),
})

export const RegisterStudentSchema = z.strictObject({
  student: StudentInputSchema,
  academicYearId: z.uuid(),
  gradeLevelId: z.uuid(),
  schoolClassId: z.uuid().optional(),
  guardians: z.array(RegistrationGuardianSchema).max(5).default([]),
})

export const DuplicateCandidateSchema = StudentSchema.pick({
  id: true,
  studentReference: true,
  givenName: true,
  familyName: true,
  dateOfBirth: true,
})

export const DuplicateWarningsSchema = z.object({
  requiresHumanReview: z.literal(true),
  candidates: z.array(DuplicateCandidateSchema),
})

export const RegistrationResponseSchema = z.object({
  student: StudentSchema,
  enrollment: EnrollmentSchema,
  guardians: z.array(GuardianLinkSchema),
  duplicateWarnings: DuplicateWarningsSchema,
})

export const StudentSummarySchema = StudentSchema.pick({
  id: true,
  studentReference: true,
  givenName: true,
  familyName: true,
})

export const StudentListResponseSchema = z.object({
  items: z.array(
    z.object({ student: StudentSummarySchema, enrollment: EnrollmentSchema }),
  ),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
})

export const StudentDetailResponseSchema = z.object({
  student: StudentSchema,
  enrollments: z.array(EnrollmentSchema),
  guardians: z.array(GuardianLinkSchema),
})

export type RegisterStudent = z.input<typeof RegisterStudentSchema>
export type RegistrationResponse = z.infer<typeof RegistrationResponseSchema>
export type StudentListResponse = z.infer<typeof StudentListResponseSchema>
export type StudentDetailResponse = z.infer<typeof StudentDetailResponseSchema>
