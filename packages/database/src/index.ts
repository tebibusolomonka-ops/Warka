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
export {
  AttendanceSummaryInputSchema,
  getAttendanceSummary,
} from './attendanceSummaries.js'
export {
  AttendanceCorrectionInputSchema,
  AttendanceCorrectionError,
  correctAttendance,
} from './attendanceCorrections.js'
export {
  AttendanceBulkInputSchema,
  AttendanceCaptureError,
  getAttendanceRoster,
  saveBulkAttendance,
  submitAttendanceSession,
} from './attendanceCapture.js'
export {
  AttendancePermissionError,
  mayManageAttendance,
  assertAttendanceManager,
} from './attendanceAuthorization.js'
export {
  StudentAttendanceRecordInputSchema,
  StudentAttendanceRecordError,
  createStudentAttendanceRecord,
} from './studentAttendanceRecords.js'
export {
  AttendanceSessionInputSchema,
  AttendanceSessionContextError,
  createAttendanceSession,
} from './attendanceSessions.js'
export {
  ClassTimetableStateError,
  ClassTimetableBlockedError,
  createClassTimetableDraft,
  publishClassTimetable,
  archiveClassTimetable,
  listClassTimetables,
} from './classTimetables.js'
export {
  validateClassTimetableEntry,
  validateSchoolTimetable,
} from './timetableValidation.js'
export type { TimetableProblem } from './timetableValidation.js'
export {
  ClassTimetableEntryInputSchema,
  ClassTimetableEntryError,
  createClassTimetableEntry,
  listClassTimetableEntries,
} from './classTimetableEntries.js'
export {
  TimetablePeriodInputSchema,
  TimetablePeriodConflictError,
  createTimetablePeriod,
  listTimetablePeriods,
} from './timetablePeriods.js'
export {
  SchoolCalendarDayInputSchema,
  SchoolCalendarDayError,
  createSchoolCalendarDay,
  listSchoolCalendarDays,
} from './schoolCalendarDays.js'
export {
  FileScannerSchema,
  createFileScan,
  latestFileScan,
} from './fileScans.js'
export {
  MaintenanceWindowInputSchema,
  createMaintenanceWindow,
  changeMaintenanceWindowStatus,
} from './maintenanceWindows.js'
export {
  createOperationalIncident,
  postOperationalIncidentUpdate,
  changeOperationalIncidentStatus,
  resolveOperationalIncident,
} from './operationalIncidents.js'
export {
  backupDue,
  cleanupEligible,
  updateBackupPolicy,
} from './backupPolicy.js'
export {
  startScheduledTask,
  enqueueFileScanTask,
  completeScheduledTask,
  failScheduledTask,
} from './scheduledTaskExecutions.js'
export { evaluateConfiguredRetentionPolicy } from './retentionPolicies.js'
export {
  createPendingBackup,
  startBackup,
  completeBackup,
  failBackup,
} from './backupRecords.js'
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
export type { User, AccountStatus } from '@prisma/client'
export {
  changeAccountStatus,
  AccountLifecyclePermissionError,
} from './accountLifecycle.js'
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
  mustChangePassword,
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
  linkStudentUser,
  findStudentAccessForUser,
  findLinkedUserForStudent,
  removeStudentAccess,
  DuplicateStudentAccessError,
} from './studentAccess.js'
export type { StudentAccess } from '@prisma/client'

export {
  linkGuardianUser,
  findGuardianAccessForUser,
  findLinkedUserForGuardian,
  removeGuardianAccess,
  DuplicateGuardianAccessError,
} from './guardianAccess.js'
export type { GuardianAccess } from '@prisma/client'

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

export {
  RecordMarkSchema,
  InvalidMarkContextError,
  MarkPermissionError,
  InvalidMarkScoreError,
  DuplicateMarkError,
  MarkNotFoundError,
  canRecordAssessment,
  recordMark,
  updateDraftMark,
  getMarksForAssessment,
  getMarksForStudentContext,
} from './marks.js'
export type { RecordMark } from './marks.js'
export type { Mark } from '@prisma/client'

export {
  InvalidMarkImportError,
  validateMarkImport,
  applyMarkImport,
} from './markImport.js'
export type {
  ImportProblem,
  ImportProblemCode,
  ImportReview,
  ImportRow,
} from './markImport.js'
export {
  SaveGradingSchemeSchema,
  InvalidGradingSchemeError,
  orderedGradeBands,
  saveGradingScheme,
  getGradingScheme,
  calculateResult,
} from './grading.js'
export type { SaveGradingScheme, CalculatedResult } from './grading.js'
export type { GradingScheme, GradeBand } from '@prisma/client'
export {
  ResultContextSchema,
  assertResultSetDraft,
  InvalidResultContextError,
  ResultPermissionError,
  ResultStateError,
  IncompleteResultsError,
  previewResults,
  submitResults,
  publishResults,
  correctPublishedResult,
  listPendingResultSets,
  listPublishedResultSets,
  listResultCorrections,
} from './results.js'
export type { ResultContext } from './results.js'
export type {
  ResultSet,
  PublishedResult,
  ResultCorrection,
  ResultSetStatus,
} from '@prisma/client'

export {
  IssueDocumentSchema,
  DocumentSnapshotSchema,
  DocumentPermissionError,
  DocumentSourceError,
  DocumentStateError,
  DocumentReasonSchema,
  correctDocument,
  withdrawDocument,
  requireDocumentAuthority,
  generateVerificationReference,
  issueDocument,
  findIssuedDocument,
  findDocumentByReference,
  listStudentDocuments,
  listSchoolDocuments,
} from './issuedDocuments.js'
export type {
  IssueDocument,
  DocumentSnapshot,
  DocumentType,
  DocumentStatus,
  IssuedDocument,
  DocumentArtifactWriter,
} from './issuedDocuments.js'

export {
  TransferPackageSchema,
  RequestTransferSchema,
  TransferPermissionError,
  TransferSourceError,
  DuplicateActiveTransferError,
  TransferStateError,
  TransferDestinationError,
  AcceptTransferSchema,
  approveTransfer,
  acceptTransfer,
  rejectTransfer,
  cancelTransfer,
  requireTransferSchoolRole,
  requestTransfer,
  listSchoolTransfers,
  findTransferForSchool,
} from './transfers.js'
export type {
  TransferPackage,
  RequestTransfer,
  AcceptTransfer,
  TransferRequest,
  TransferStatus,
} from './transfers.js'

export {
  verifyGuardianRelationship,
  revokeGuardianRelationship,
  hasActiveVerifiedGuardianRelationship,
  GuardianRelationshipPermissionError,
  GuardianRelationshipStateError,
} from './guardianRelationships.js'
export type { GuardianVerificationStatus } from '@prisma/client'

export {
  getParentPortalSetting,
  setParentPortalEnabled,
  canAccessParentChild,
  ParentServicePermissionError,
} from './parentService.js'
export type { SchoolServiceAccess } from '@prisma/client'

export type {
  FamilyConversation,
  FamilyMessage,
  FamilyConversationRoute,
  FamilyConversationStatus,
} from '@prisma/client'

export {
  grantBureauAccess,
  revokeBureauAccess,
  resolveBureauScope,
  requireBureauPermission,
  DuplicateBureauAccessError,
  BureauAccessDeniedError,
} from './bureauAccess.js'
export type { BureauAccess, BureauRole } from '@prisma/client'

export {
  CreateReportingPeriodSchema,
  createReportingPeriod,
  openReportingPeriod,
  closeReportingPeriod,
  assignRequiredSchools,
  removeRequiredSchool,
  ReportingRequirementStateError,
  listReportingPeriods,
} from './reportingPeriods.js'
export type {
  ReportingPeriod,
  ReportingPeriodStatus,
  ReportingRequirement,
} from '@prisma/client'

export {
  ReportingSubmissionError,
  prepareSchoolReport,
  submitSchoolReport,
  approveSchoolReport,
  returnSchoolReport,
} from './reportingSubmissions.js'
export type {
  ReportingSubmission,
  ReportingSubmissionStatus,
} from '@prisma/client'

export {
  buildEnrollmentAggregate,
  summarizeEnrollmentRows,
} from './enrollmentReporting.js'
export type { EnrollmentAggregate } from './enrollmentReporting.js'

export {
  buildAcademicAggregate,
  summarizeAcademicOutcomes,
} from './academicReporting.js'
export type { AcademicOutcomeAggregate } from './academicReporting.js'

export {
  buildRegionalActivityAggregate,
  emptyRegionalActivity,
} from './activityReporting.js'
export type { RegionalActivityAggregate } from './activityReporting.js'
export type {
  VerificationEvent,
  VerificationResultStatus,
} from '@prisma/client'

export {
  calculateCoverage,
  calculateFreshness,
  getReportingCoverage,
  listMissingSchools,
  listReturnedSubmissions,
} from './reportingCoverage.js'
export type { ReportingCoverage, FreshnessStatus } from './reportingCoverage.js'

export {
  AuditActionSchema,
  AuditResourceTypeSchema,
  AuditMetadataSchema,
  RecordAuditEventSchema,
  recordAuditEvent,
  listAuditEvents,
} from './auditEvents.js'
export type { AuditEvent } from '@prisma/client'
export {
  AccessReviewScopeSchema,
  AccessReviewDecisionSchema,
  AccessReviewPermissionError,
  AccessReviewStateError,
  startAccessReview,
  setAccessReviewDecision,
  completeAccessReview,
  listAccessReviews,
  getAccessReview,
} from './accessReviews.js'
export type {
  AccessReview,
  AccessReviewEntry,
  ReviewDecision,
} from './accessReviews.js'
export {
  SupportAccessPermissionError,
  SupportAccessStateError,
  SupportAccessDeniedError,
  createSupportIdentity,
  listSupportIdentities,
  requestSupportAccess,
  approveSupportAccess,
  revokeSupportAccess,
  checkSupportAccess,
  listSupportAccessGrants,
} from './supportAccess.js'
export type { SupportAccessGrant, SupportIdentity } from './supportAccess.js'
export {
  RetentionCategorySchema,
  SaveRetentionPolicySchema,
  RetentionPermissionError,
  RetentionPolicyNotFoundError,
  createRetentionPolicy,
  listRetentionPolicies,
  evaluateRetention,
} from './retentionPolicies.js'
export type { RetentionPolicy } from './retentionPolicies.js'

export {
  CreateImportJobSchema,
  ImportIssueSchema,
  ImportPermissionError,
  ImportStateError,
  requireSchoolImportPermission,
  createImportJob,
  listSchoolImportJobs,
  getImportJob,
  recordImportValidation,
  cancelImportJob,
} from './importJobs.js'
export type { ImportJob, ImportRowIssue, ImportJobStatus } from '@prisma/client'

export {
  validateStudentImport,
  readValidatedStudentRows,
  applyStudentImport,
} from './studentImports.js'
export { NormalizedStudentImportRowSchema } from './importJobs.js'
export type { NormalizedStudentImportRow } from './importJobs.js'

export {
  SchoolExportTypeSchema,
  serializeCsv,
  createSchoolExport,
} from './schoolExports.js'
export type { SchoolExportType } from './schoolExports.js'

export {
  CreateNotificationSchema,
  createNotification,
  createNotifications,
  listNotifications,
  unreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from './notifications.js'
export type { CreateNotification } from './notifications.js'
export type { Notification } from '@prisma/client'
export {
  QueueEmailDeliverySchema,
  queueEmailDelivery,
  getEmailDelivery,
  listEmailDeliveries,
  cancelQueuedEmailDelivery,
} from './emailDeliveries.js'
export type { QueueEmailDelivery } from './emailDeliveries.js'
export {
  NotificationCategorySchema,
  DigestCadenceSchema,
  digestCategories,
  notificationCategories,
  getNotificationPreferences,
  setNotificationPreference,
} from './notificationPreferences.js'
export type { EffectiveNotificationPreference } from './notificationPreferences.js'
export {
  CreateEmailDigestSchema,
  createEmailDigest,
  listEmailDigests,
  markEmailDigestSent,
} from './emailDigests.js'
export {
  deriveRecoveryToken,
  issueDerivedRecoveryToken,
} from './recoveryTokens.js'

export {
  SchoolDocumentProfileInputSchema,
  SchoolDocumentProfilePermissionError,
  getSchoolDocumentProfile,
  saveSchoolDocumentProfile,
  requireSchoolDocumentProfileManager,
} from './schoolDocumentProfiles.js'
export type { SchoolDocumentProfile } from '@prisma/client'

export {
  CreateDocumentRequestSchema,
  DocumentRequestPermissionError,
  DocumentRequestStateError,
  requireDocumentRequestStaff,
  createDocumentRequest,
  listStudentDocumentRequests,
  listSchoolDocumentRequests,
  getDocumentRequest,
  cancelDocumentRequest,
} from './documentRequests.js'
export type { DocumentRequest, DocumentRequestStatus } from '@prisma/client'

export {
  startDocumentRequest,
  issueRequestedDocument,
  rejectDocumentRequest,
} from './documentRequestWorkflow.js'

export {
  RecordEnrollmentHistorySchema,
  recordEnrollmentHistory,
  listEnrollmentHistory,
} from './enrollmentHistory.js'
export type { RecordEnrollmentHistory } from './enrollmentHistory.js'
export type {
  EnrollmentHistoryEvent,
  EnrollmentHistoryType,
} from '@prisma/client'

export {
  AcademicYearClosingPermissionError,
  AcademicYearClosingStateError,
  AcademicYearClosingBlockedError,
  closingBlockers,
  requireAcademicYearAdmin,
  getYearClosingReadiness,
  startAcademicYearClosing,
  completeAcademicYearClosing,
} from './academicYearClosing.js'
export type { YearClosingBlocker } from './academicYearClosing.js'
export type { AcademicYearStatus } from '@prisma/client'

export {
  CreateProgressionPlanSchema,
  ProgressionPlanSourceError,
  DuplicateActiveProgressionPlanError,
  ProgressionPlanStateError,
  createProgressionPlan,
  listProgressionPlans,
  getProgressionPlan,
  cancelProgressionPlan,
} from './progressionPlans.js'
export type { CreateProgressionPlan } from './progressionPlans.js'
export type {
  ProgressionPlan,
  ProgressionEntry,
  ProgressionPlanStatus,
  ProgressionAction,
} from '@prisma/client'

export {
  UpdateProgressionEntrySchema,
  ProgressionValidationError,
  updateProgressionEntry,
  previewProgressionPlan,
  markProgressionPlanReviewed,
} from './progressionValidation.js'
export type {
  UpdateProgressionEntry,
  ProgressionProblem,
} from './progressionValidation.js'

export {
  BulkPromotionSchema,
  BulkDecisionSchema,
  bulkPreparePromotions,
  bulkSetProgressionDecision,
} from './progressionBulk.js'
export type { BulkPromotion, BulkDecision } from './progressionBulk.js'

export { applyProgressionPlan } from './progressionApply.js'
export type { ProgressionApplyResult } from './progressionApply.js'

export {
  ProgressionExceptionStateError,
  exceptionKind,
  refreshProgressionExceptions,
  listProgressionExceptions,
  resolveProgressionException,
} from './progressionExceptions.js'
export type {
  ProgressionException,
  ProgressionExceptionKind,
  ProgressionExceptionStatus,
} from '@prisma/client'

export {
  createRecoveryRequest,
  findActiveRecoveryRequest,
  expireRecoveryRequests,
  cancelRecoveryRequest,
  completeRecoveryRequest,
} from './accountRecoveryRequests.js'

export {
  createRecoveryToken,
  resolveRecoveryToken,
  consumeRecoveryToken,
  hashRecoveryToken,
} from './recoveryTokens.js'

export {
  assistAccountRecovery,
  AdministratorRecoveryPermissionError,
} from './administratorRecovery.js'

export {
  loginEmailHash,
  isLoginThrottled,
  recordFailedLogin,
  clearFailedLogins,
} from './loginAttempts.js'

export {
  getSchoolOnboarding,
  startSchoolOnboarding,
  pauseSchoolOnboarding,
  SchoolOnboardingStateError,
} from './schoolOnboarding.js'

export {
  derivedChecklist,
  listOnboardingChecklist,
  updateManualChecklistItem,
  ManualChecklistKeySchema,
  ManualChecklistStatusSchema,
} from './onboardingChecklist.js'

export {
  SchoolContactSchema,
  listSchoolContacts,
  createSchoolContact,
  updateSchoolContact,
  deleteSchoolContact,
} from './schoolContacts.js'

export {
  evaluateSchoolReadiness,
  summarizeReadiness,
} from './onboardingReadiness.js'
export type { ReadinessCheck } from './onboardingReadiness.js'

export {
  TrainingTypeSchema,
  TrainingRecordStateError,
  listTrainingRecords,
  assignTrainingRecord,
  finishTrainingRecord,
} from './trainingRecords.js'

export {
  submitSchoolOnboarding,
  completeSchoolOnboarding,
} from './schoolOnboarding.js'

export { OnboardingChecklistStateError } from './onboardingChecklist.js'

export {
  CreateSupportRequestSchema,
  SupportRequestPermissionError,
  SupportRequestStateError,
  requireSchoolSupportUser,
  createSupportRequest,
  listSchoolSupportRequests,
} from './supportRequests.js'

export {
  listRoutedSupportRequests,
  getRoutedSupportRequest,
  replyToSupportRequest,
  resolveSupportRequest,
  closeSupportRequest,
} from './supportRouting.js'

export { listSupportCaseSchools } from './supportRouting.js'

export {
  isMembershipEffective,
  effectiveMembershipWhere,
} from './membershipPeriods.js'

export {
  offboardStaff,
  StaffOffboardingPermissionError,
} from './staffOffboarding.js'

export {
  listStaffAccess,
  accessPeriodStatus,
  StaffAccessPermissionError,
} from './staffAccessSummary.js'

export {
  StudentCorrectionInputSchema,
  StudentCorrectionPermissionError,
  StudentCorrectionStateError,
  createStudentCorrectionRequest,
} from './studentCorrectionRequests.js'
export type {
  StudentCorrectionRequest,
  StudentCorrectionField,
  CorrectionRequestStatus,
} from '@prisma/client'

export {
  EnrollmentCorrectionInputSchema,
  EnrollmentCorrectionPermissionError,
  EnrollmentCorrectionStateError,
  createEnrollmentCorrectionRequest,
} from './enrollmentCorrectionRequests.js'
export type { EnrollmentCorrectionRequest } from '@prisma/client'

export {
  reviewStudentCorrection,
  reviewEnrollmentCorrection,
  listCorrectionRequests,
  CorrectionPermissionError,
  CorrectionStateError,
} from './correctionReview.js'

export {
  PrivacyRequestInputSchema,
  PrivacyPermissionError,
  privacyRequesterScope,
  createPrivacyRequest,
  listOwnPrivacyRequests,
} from './privacyRequests.js'

export {
  generatePrivacyAccessPackage,
  PrivacyPackageStateError,
} from './privacyAccessPackages.js'

export { requirePrivacyReviewer } from './privacyReviewAccess.js'
export {
  routePrivacyCorrection,
  PrivacyCorrectionStateError,
} from './privacyCorrectionRouting.js'

export {
  applyProcessingRestriction,
  endProcessingRestriction,
  isParentPortalSharingRestricted,
  ProcessingRestrictionStateError,
} from './processingRestrictions.js'

export {
  reviewPrivacyRequest,
  fulfillPrivacyAccessRequest,
  cancelOwnPrivacyRequest,
  PrivacyReviewStateError,
} from './privacyReview.js'

export {
  createRetentionHold,
  releaseRetentionHold,
  listRetentionHolds,
} from './retentionHolds.js'

export {
  AssessmentRoomInputSchema,
  AssessmentRoomConflictError,
  createAssessmentRoom,
  setAssessmentRoomActive,
  listAssessmentRooms,
} from './assessmentRooms.js'

export {
  AssessmentScheduleInputSchema,
  AssessmentScheduleContextError,
  createAssessmentSchedule,
} from './assessmentSchedules.js'

export {
  AssessmentScheduleConflictError,
  validateAssessmentSchedule,
  scheduleAssessment,
} from './assessmentScheduleValidation.js'

export {
  AssessmentSessionStateError,
  createAssessmentSession,
  openAssessmentSession,
  completeAssessmentSession,
} from './assessmentSessions.js'

export {
  AssessmentParticipationInputSchema,
  AssessmentParticipationContextError,
  recordAssessmentParticipation,
} from './assessmentParticipation.js'

export {
  MakeUpRequestSchema,
  MakeUpScheduleSchema,
  MakeUpAssessmentStateError,
  requestMakeUpAssessment,
  reviewMakeUpAssessment,
  scheduleMakeUpAssessment,
  completeMakeUpAssessment,
} from './makeUpAssessments.js'

export {
  AssessmentInvigilationError,
  assignAssessmentInvigilator,
} from './assessmentInvigilation.js'

export {
  MarkEntryWindowInputSchema,
  MarkEntryOverrideReasonSchema,
  MarkEntryWindowStateError,
  createMarkEntryWindow,
  transitionMarkEntryWindow,
  assertMarkEntryWindow,
} from './markEntryWindows.js'

export {
  GradebookContextError,
  getGradebookCompleteness,
} from './gradebookCompleteness.js'

export {
  MarkModerationRequestSchema,
  MarkModerationStateError,
  requestMarkModeration,
} from './markModerationRequests.js'

export { reviewMarkModeration } from './markModerationReview.js'

export {
  GradebookLockStateError,
  assertGradebookUnlocked,
  lockGradebook,
  unlockGradebook,
} from './gradebookLocks.js'

export { getResultPublicationReadiness } from './resultPublicationReadiness.js'
