import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import {
  createDatabaseClient,
  DuplicateEnrollmentError,
  EnrollmentNotFoundError,
  InvalidEnrollmentStructureError,
  InvalidEnrollmentTransitionError,
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
  prismaStudentOptionsService,
  type StudentOptionsService,
} from './studentOptionsService.js'
import {
  prismaEnrollmentService,
  type EnrollmentService,
} from './enrollmentService.js'
import { registerEnrollmentRoutes } from './enrollmentRoutes.js'

export function buildApp(
  options: {
    store?: SchoolStore
    auth?: AuthService
    access?: SchoolAccess
    students?: StudentService
    studentOptions?: StudentOptionsService
    enrollments?: EnrollmentService
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
  const getStudentOptions = () =>
    options.studentOptions ?? prismaStudentOptionsService(getDatabase())
  const getEnrollments = () =>
    options.enrollments ?? prismaEnrollmentService(getDatabase())
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
    getStudentOptions,
    authenticate,
  )
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
