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
  mustChangePassword: z.boolean().optional(),
})

export type UserIdentity = z.infer<typeof UserIdentitySchema>

export const StudentPortalIdentitySchema = z.object({
  studentReference: z.string(),
  givenName: z.string(),
  familyName: z.string().nullable(),
  currentEnrollment: z
    .object({
      school: z.string(),
      academicYear: z.string(),
      gradeLevel: z.string(),
      schoolClass: z.string().nullable(),
    })
    .nullable(),
})
export type StudentPortalIdentity = z.infer<typeof StudentPortalIdentitySchema>

export const StudentResultSchema = z.object({
  academicYear: z.string(),
  gradingPeriod: z.string(),
  subject: z.string(),
  percentage: z.number(),
  gradeLabel: z.string(),
  publishedAt: z.iso.datetime(),
  corrected: z.boolean(),
})
export const StudentResultsSchema = z.array(StudentResultSchema)
export type StudentResult = z.infer<typeof StudentResultSchema>

export const StudentMaterialSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  resourceType: z.literal('link'),
  resourceLocation: z.url(),
  subject: z.string(),
  academicYear: z.string(),
  publishedAt: z.iso.datetime(),
})
export const StudentMaterialsSchema = z.array(StudentMaterialSchema)
export type StudentMaterial = z.infer<typeof StudentMaterialSchema>

export const StudentAnnouncementSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string(),
  publishedAt: z.iso.datetime(),
  scope: z.discriminatedUnion('type', [
    z.object({ type: z.literal('school') }),
    z.object({ type: z.literal('class'), name: z.string() }),
  ]),
})
export const StudentAnnouncementsSchema = z.array(StudentAnnouncementSchema)
export type StudentAnnouncement = z.infer<typeof StudentAnnouncementSchema>

export const StudentAccountStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('none') }),
  z.object({
    status: z.literal('active'),
    email: z.email(),
    displayName: z.string(),
    mustChangePassword: z.boolean(),
  }),
])
export type StudentAccountStatus = z.infer<typeof StudentAccountStatusSchema>

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

export const DocumentVerificationSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('unavailable') }),
  z.strictObject({ status: z.literal('corrected') }),
  z.strictObject({ status: z.literal('withdrawn') }),
  z.strictObject({
    status: z.literal('active'),
    documentType: z.enum(['reportCard', 'transcript']),
    issuingSchool: z.string(),
    student: z.strictObject({
      displayName: z.string(),
      studentReference: z.string(),
    }),
    issuedAt: z.iso.datetime(),
    academicYear: z.string(),
    subjects: z.array(
      z.strictObject({
        subject: z.string(),
        gradingPeriod: z.string(),
        percentage: z.number(),
        gradeLabel: z.string(),
      }),
    ),
  }),
])
export type DocumentVerification = z.infer<typeof DocumentVerificationSchema>

export const IssuedDocumentSummarySchema = z.strictObject({
  id: z.uuid(),
  documentType: z.enum(['reportCard', 'transcript']),
  verificationReference: z.string(),
  status: z.enum(['active', 'corrected', 'withdrawn']),
  issuedAt: z.iso.datetime(),
  supersedesId: z.uuid().nullable(),
})
export type IssuedDocumentSummary = z.infer<typeof IssuedDocumentSummarySchema>

export const StudentDocumentsSchema = z.strictObject({
  documents: z.array(IssuedDocumentSummarySchema),
  eligibleYears: z.array(z.strictObject({ id: z.uuid(), name: z.string() })),
})
export type StudentDocuments = z.infer<typeof StudentDocumentsSchema>

export const TransferStatusSchema = z.enum([
  'requested',
  'approvedBySendingSchool',
  'acceptedByReceivingSchool',
  'rejected',
  'cancelled',
])
export const TransferViewSchema = z.strictObject({
  id: z.uuid(),
  status: TransferStatusSchema,
  student: z.strictObject({
    displayName: z.string(),
    studentReference: z.string(),
  }),
  sendingSchool: z.string(),
  receivingSchool: z.string(),
  sourceEnrollment: z.strictObject({
    status: z.enum(['draft', 'pending', 'approved', 'withdrawn']),
    academicYear: z.string(),
    gradeLevel: z.string(),
    schoolClass: z.string().nullable(),
  }),
  receivingEnrollment: z
    .strictObject({
      status: z.enum(['draft', 'pending', 'approved', 'withdrawn']),
      academicYear: z.string(),
      gradeLevel: z.string(),
      schoolClass: z.string().nullable(),
    })
    .nullable(),
  requestedAt: z.iso.datetime(),
  sendingApprovedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  rejectionReason: z.string().nullable(),
  cancellationReason: z.string().nullable(),
})
export type TransferView = z.infer<typeof TransferViewSchema>
export const TransferOptionsSchema = z.strictObject({
  eligibleStudents: z.array(
    z.strictObject({
      studentId: z.uuid(),
      studentReference: z.string(),
      displayName: z.string(),
      sourceEnrollmentId: z.uuid(),
      academicYear: z.string(),
      gradeLevel: z.string(),
    }),
  ),
  receivingSchools: z.array(z.strictObject({ id: z.uuid(), name: z.string() })),
  academicYears: z.array(z.strictObject({ id: z.uuid(), name: z.string() })),
  gradeLevels: z.array(z.strictObject({ id: z.uuid(), name: z.string() })),
  classes: z.array(
    z.strictObject({
      id: z.uuid(),
      name: z.string(),
      academicYearId: z.uuid(),
      gradeLevelId: z.uuid(),
    }),
  ),
})
export type TransferOptions = z.infer<typeof TransferOptionsSchema>

export const ParentIdentitySchema = z.object({ displayName: z.string() })
export type ParentIdentity = z.infer<typeof ParentIdentitySchema>

export const ParentChildSchema = z.object({
  studentReference: z.string(),
  displayName: z.string(),
  schoolId: z.uuid(),
  school: z.string(),
  academicYear: z.string(),
  gradeLevel: z.string(),
  schoolClass: z.string().nullable(),
  relationship: z.string(),
})
export const ParentChildrenSchema = z.array(ParentChildSchema)
export type ParentChild = z.infer<typeof ParentChildSchema>

export const SchoolParentPortalSettingSchema = z.object({
  parentPortalEnabled: z.boolean(),
  enabledAt: z.iso.datetime().nullable(),
})
export type SchoolParentPortalSetting = z.infer<
  typeof SchoolParentPortalSettingSchema
>

export const GuardianRelationshipViewSchema = z.object({
  guardianId: z.uuid(),
  name: z.string(),
  relationship: z.string(),
  verificationStatus: z.enum(['pending', 'verified', 'revoked']),
  verifiedAt: z.iso.datetime().nullable(),
  revokedAt: z.iso.datetime().nullable(),
  account: z.object({ email: z.email(), displayName: z.string() }).nullable(),
})
export type GuardianRelationshipView = z.infer<
  typeof GuardianRelationshipViewSchema
>

export const FamilyConversationSummarySchema = z.object({
  id: z.uuid(),
  studentReference: z.string(),
  studentName: z.string(),
  school: z.string().nullable(),
  route: z.enum(['teacher', 'schoolOffice']),
  status: z.enum(['open', 'closed']),
  escalatedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  lastMessage: z
    .object({ body: z.string(), createdAt: z.iso.datetime() })
    .nullable(),
})
export type FamilyConversationSummary = z.infer<
  typeof FamilyConversationSummarySchema
>

export const FamilyMessageViewSchema = z.object({
  id: z.uuid(),
  body: z.string(),
  sender: z.enum(['guardian', 'school']),
  createdAt: z.iso.datetime(),
})
export const FamilyConversationDetailSchema = z.object({
  id: z.uuid(),
  route: z.enum(['teacher', 'schoolOffice']),
  status: z.enum(['open', 'closed']),
  escalatedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  messages: z.array(FamilyMessageViewSchema),
})
export type FamilyConversationDetail = z.infer<
  typeof FamilyConversationDetailSchema
>

export const TeacherContactSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  subject: z.string(),
})
export type TeacherContact = z.infer<typeof TeacherContactSchema>
