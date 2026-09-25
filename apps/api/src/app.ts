import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import {
  createDatabaseClient,
  DuplicateEnrollmentError,
  EnrollmentNotFoundError,
  InvalidEnrollmentStructureError,
  InvalidEnrollmentTransitionError,
  DuplicateAssessmentError,
  DuplicateGradingPeriodError,
  DuplicateSubjectError,
  DuplicateTeachingAssignmentError,
  DuplicateMarkError,
  InvalidAssessmentContextError,
  InvalidGradingPeriodError,
  InvalidTeachingAssignmentError,
  InvalidMarkContextError,
  InvalidMarkScoreError,
  InvalidMarkImportError,
  InvalidGradingSchemeError,
  InvalidResultContextError,
  MarkPermissionError,
  ResultPermissionError,
  ResultStateError,
  IncompleteResultsError,
  DocumentPermissionError,
  DocumentSourceError,
  DocumentStateError,
  DuplicateActiveTransferError,
  TransferDestinationError,
  TransferPermissionError,
  TransferSourceError,
  TransferStateError,
  type PrismaClient,
} from '@warka/database'
import { ErrorResponseSchema, HealthResponseSchema } from '@warka/shared'
import { ZodError } from 'zod'
import { createAuthService, type AuthService } from './authService.js'
import { registerAuthRoutes } from './authRoutes.js'
import { authenticateRequest } from './authenticateRequest.js'
import { createSchoolAccess, type SchoolAccess } from './schoolAccess.js'
import {
  RecordNotFound,
  prismaSchoolStore,
  type SchoolStore,
} from './schoolService.js'
import { registerSchoolRoutes } from './schoolRoutes.js'
import { prismaStudentService, type StudentService } from './studentService.js'
import { registerStudentRoutes } from './studentRoutes.js'
import {
  prismaStudentPortalService,
  StudentPortalAccessError,
  type StudentPortalService,
} from './studentPortalService.js'
import { registerStudentPortalRoutes } from './studentPortalRoutes.js'
import {
  prismaLearningMaterialService,
  LearningMaterialAccessError,
  type LearningMaterialService,
} from './learningMaterialService.js'
import { registerLearningMaterialRoutes } from './learningMaterialRoutes.js'
import {
  prismaAnnouncementService,
  AnnouncementAccessError,
  type AnnouncementService,
} from './announcementService.js'
import { registerAnnouncementRoutes } from './announcementRoutes.js'
import {
  prismaDocumentVerificationService,
  type DocumentVerificationService,
} from './documentVerificationService.js'
import { registerDocumentVerificationRoutes } from './documentVerificationRoutes.js'
import {
  DocumentStudentNotFoundError,
  prismaDocumentManagementService,
  type DocumentManagementService,
} from './documentManagementService.js'
import { registerDocumentManagementRoutes } from './documentManagementRoutes.js'
import {
  TransferNotFoundError,
  prismaTransferManagementService,
  type TransferManagementService,
} from './transferManagementService.js'
import { registerTransferRoutes } from './transferRoutes.js'
import {
  prismaStudentAccountService,
  StudentAccountConflictError,
  StudentEnrollmentNotFoundError,
  type StudentAccountService,
} from './studentAccountService.js'
import {
  prismaStudentOptionsService,
  type StudentOptionsService,
} from './studentOptionsService.js'
import {
  prismaEnrollmentService,
  type EnrollmentService,
} from './enrollmentService.js'
import { registerEnrollmentRoutes } from './enrollmentRoutes.js'
import {
  AcademicAccessError,
  prismaAcademicService,
  type AcademicService,
} from './academicService.js'
import { registerAcademicRoutes } from './academicRoutes.js'

export function buildApp(
  options: {
    store?: SchoolStore
    auth?: AuthService
    access?: SchoolAccess
    students?: StudentService
    studentAccounts?: StudentAccountService
    studentPortal?: StudentPortalService
    materials?: LearningMaterialService
    announcements?: AnnouncementService
    verification?: DocumentVerificationService
    documents?: DocumentManagementService
    transfers?: TransferManagementService
    studentOptions?: StudentOptionsService
    enrollments?: EnrollmentService
    academic?: AcademicService
    production?: boolean
  } = {},
) {
  const app = Fastify()
  let database: PrismaClient | undefined

  const getDatabase = () => (database ??= createDatabaseClient())
  const getStore = () => options.store ?? prismaSchoolStore(getDatabase())
  const getAuth = () => options.auth ?? createAuthService(getDatabase())
  const getAccess = () => options.access ?? createSchoolAccess(getDatabase())
  const getStudents = () =>
    options.students ?? prismaStudentService(getDatabase())
  const getAnnouncements = () =>
    options.announcements ?? prismaAnnouncementService(getDatabase())
  const getMaterials = () =>
    options.materials ?? prismaLearningMaterialService(getDatabase())
  const getStudentPortal = () =>
    options.studentPortal ?? prismaStudentPortalService(getDatabase())
  const getStudentAccounts = () =>
    options.studentAccounts ?? prismaStudentAccountService(getDatabase())
  const getStudentOptions = () =>
    options.studentOptions ?? prismaStudentOptionsService(getDatabase())
  const getEnrollments = () =>
    options.enrollments ?? prismaEnrollmentService(getDatabase())
  const getAcademic = () =>
    options.academic ?? prismaAcademicService(getDatabase())
  const authenticate = authenticateRequest(getAuth)

  app.register(cookie)
  app.decorateRequest('currentUser', null)
  app.get('/health', async () => HealthResponseSchema.parse({ status: 'ok' }))
  registerAuthRoutes(
    app,
    getAuth,
    options.production ?? process.env.NODE_ENV === 'production',
  )
  registerSchoolRoutes(app, getStore, getAccess, authenticate)
  registerStudentRoutes(
    app,
    getStore,
    getAccess,
    getStudents,
    getStudentAccounts,
    getStudentOptions,
    authenticate,
  )
  registerStudentPortalRoutes(app, getStudentPortal, authenticate)
  registerLearningMaterialRoutes(app, getMaterials, authenticate)
  registerAnnouncementRoutes(app, getAnnouncements, authenticate)
  registerTransferRoutes(
    app,
    () => options.transfers ?? prismaTransferManagementService(getDatabase()),
    authenticate,
  )
  registerDocumentManagementRoutes(
    app,
    () => options.documents ?? prismaDocumentManagementService(getDatabase()),
    authenticate,
  )
  registerDocumentVerificationRoutes(
    app,
    () =>
      options.verification ?? prismaDocumentVerificationService(getDatabase()),
  )
  registerAcademicRoutes(app, getAcademic, authenticate)
  registerEnrollmentRoutes(
    app,
    getStore,
    getAccess,
    getEnrollments,
    authenticate,
  )

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send(
      ErrorResponseSchema.parse({
        error: { code: 'NOT_FOUND', message: 'Route not found' },
      }),
    ),
  )

  app.setErrorHandler((error, _request, reply) => {
    if (
      error instanceof TransferPermissionError ||
      error instanceof TransferNotFoundError
    ) {
      return reply.code(404).send({
        error: { code: 'TRANSFER_NOT_FOUND', message: 'Transfer not found' },
      })
    }
    if (
      error instanceof TransferSourceError ||
      error instanceof TransferDestinationError
    ) {
      return reply.code(400).send({
        error: { code: 'INVALID_TRANSFER', message: error.message },
      })
    }
    if (
      error instanceof TransferStateError ||
      error instanceof DuplicateActiveTransferError
    ) {
      return reply.code(409).send({
        error: { code: 'TRANSFER_CONFLICT', message: error.message },
      })
    }
    if (
      error instanceof DocumentPermissionError ||
      error instanceof DocumentStudentNotFoundError
    ) {
      return reply.code(404).send({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: 'Document record not found',
        },
      })
    }
    if (
      error instanceof DocumentSourceError ||
      error instanceof DocumentStateError
    ) {
      return reply.code(409).send({
        error: { code: 'DOCUMENT_CONFLICT', message: error.message },
      })
    }
    if (error instanceof ZodError) {
      return reply.code(400).send(
        ErrorResponseSchema.parse({
          error: { code: 'INVALID_REQUEST', message: 'Invalid request data' },
        }),
      )
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 400
    ) {
      return reply.code(400).send(
        ErrorResponseSchema.parse({
          error: { code: 'INVALID_REQUEST', message: 'Invalid request data' },
        }),
      )
    }
    if (error instanceof AnnouncementAccessError) {
      return reply.code(404).send({
        error: { code: 'ANNOUNCEMENT_NOT_FOUND', message: error.message },
      })
    }
    if (error instanceof LearningMaterialAccessError) {
      return reply
        .code(404)
        .send({ error: { code: 'MATERIAL_NOT_FOUND', message: error.message } })
    }
    if (error instanceof StudentPortalAccessError) {
      return reply.code(403).send({
        error: { code: 'STUDENT_ACCESS_REQUIRED', message: error.message },
      })
    }
    if (error instanceof StudentAccountConflictError) {
      return reply.code(409).send({
        error: { code: 'STUDENT_ACCOUNT_CONFLICT', message: error.message },
      })
    }
    if (error instanceof StudentEnrollmentNotFoundError) {
      return reply.code(404).send({
        error: { code: 'STUDENT_NOT_FOUND', message: 'Student not found' },
      })
    }
    if (error instanceof RecordNotFound) {
      return reply.code(404).send(
        ErrorResponseSchema.parse({
          error: { code: error.code, message: error.message },
        }),
      )
    }
    if (error instanceof EnrollmentNotFoundError) {
      return reply.code(404).send(
        ErrorResponseSchema.parse({
          error: {
            code: 'ENROLLMENT_NOT_FOUND',
            message: error.message,
          },
        }),
      )
    }
    if (error instanceof InvalidEnrollmentTransitionError) {
      return reply.code(409).send(
        ErrorResponseSchema.parse({
          error: {
            code: 'INVALID_ENROLLMENT_TRANSITION',
            message: error.message,
          },
        }),
      )
    }
    if (error instanceof InvalidEnrollmentStructureError) {
      return reply.code(400).send(
        ErrorResponseSchema.parse({
          error: {
            code: 'INVALID_ENROLLMENT_STRUCTURE',
            message: error.message,
          },
        }),
      )
    }
    if (error instanceof DuplicateEnrollmentError) {
      return reply.code(409).send(
        ErrorResponseSchema.parse({
          error: { code: 'DUPLICATE_ENROLLMENT', message: error.message },
        }),
      )
    }
    if (
      error instanceof AcademicAccessError ||
      error instanceof ResultPermissionError ||
      error instanceof MarkPermissionError ||
      error instanceof InvalidResultContextError ||
      error instanceof InvalidMarkContextError
    ) {
      return reply.code(404).send({
        error: {
          code: 'ACADEMIC_RESOURCE_NOT_FOUND',
          message: 'Academic resource not found',
        },
      })
    }
    if (error instanceof InvalidMarkImportError) {
      return reply.code(422).send({
        error: {
          code: 'INVALID_MARK_IMPORT',
          message: error.message,
          problems: error.problems,
        },
      })
    }
    if (error instanceof ResultStateError) {
      return reply.code(409).send({
        error: { code: 'RESULT_STATE', message: error.message },
      })
    }
    if (error instanceof IncompleteResultsError) {
      return reply.code(422).send({
        error: { code: 'INCOMPLETE_RESULTS', message: error.message },
      })
    }
    if (
      error instanceof DuplicateAssessmentError ||
      error instanceof DuplicateGradingPeriodError ||
      error instanceof DuplicateSubjectError ||
      error instanceof DuplicateTeachingAssignmentError ||
      error instanceof DuplicateMarkError
    ) {
      return reply.code(409).send({
        error: { code: 'ACADEMIC_DUPLICATE', message: error.message },
      })
    }
    if (
      error instanceof InvalidAssessmentContextError ||
      error instanceof InvalidGradingPeriodError ||
      error instanceof InvalidTeachingAssignmentError ||
      error instanceof InvalidMarkScoreError ||
      error instanceof InvalidGradingSchemeError
    ) {
      return reply.code(400).send({
        error: { code: 'INVALID_ACADEMIC_DATA', message: error.message },
      })
    }
    app.log.error(error)
    return reply.code(500).send(
      ErrorResponseSchema.parse({
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      }),
    )
  })

  app.addHook('onClose', async () => {
    await database?.$disconnect()
  })

  return app
}
