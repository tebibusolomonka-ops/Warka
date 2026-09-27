import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  createStudentCorrectionRequest,
  createEnrollmentCorrectionRequest,
  listCorrectionRequests,
  reviewStudentCorrection,
  reviewEnrollmentCorrection,
  type PrismaClient,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'

const studentParams = z.strictObject({
  schoolId: z.uuid(),
  studentId: z.uuid(),
})
const enrollmentParams = z.strictObject({
  schoolId: z.uuid(),
  enrollmentId: z.uuid(),
})
const listParams = z.strictObject({
  schoolId: z.uuid(),
  kind: z.enum(['student', 'enrollment']),
})
const reviewParams = listParams.extend({
  requestId: z.uuid(),
  decision: z.enum(['approve', 'reject', 'cancel']),
})
const query = z.strictObject({
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  studentId: z.uuid().optional(),
  enrollmentId: z.uuid().optional(),
  take: z.coerce.number().int().min(1).max(50).optional(),
  skip: z.coerce.number().int().min(0).max(100000).optional(),
})
const reviewBody = z.strictObject({
  reason: z.string().trim().min(3).max(500).optional(),
})

export function registerCorrectionRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.post(
    '/schools/:schoolId/students/:studentId/corrections',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, studentId } = studentParams.parse(request.params)
      return reply
        .code(201)
        .send(
          await createStudentCorrectionRequest(
            getDatabase(),
            authenticatedUser(request).id,
            schoolId,
            studentId,
            request.body,
          ),
        )
    },
  )
  app.post(
    '/schools/:schoolId/enrollments/:enrollmentId/corrections',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, enrollmentId } = enrollmentParams.parse(request.params)
      return reply
        .code(201)
        .send(
          await createEnrollmentCorrectionRequest(
            getDatabase(),
            authenticatedUser(request).id,
            schoolId,
            enrollmentId,
            request.body,
          ),
        )
    },
  )
  app.get(
    '/schools/:schoolId/corrections/:kind',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, kind } = listParams.parse(request.params)
      return listCorrectionRequests(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
        kind,
        query.parse(request.query),
      )
    },
  )
  app.post(
    '/schools/:schoolId/corrections/:kind/:requestId/:decision',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, kind, requestId, decision } = reviewParams.parse(
        request.params,
      )
      const { reason } = reviewBody.parse(request.body ?? {})
      if (kind === 'student')
        return reviewStudentCorrection(
          getDatabase(),
          authenticatedUser(request).id,
          schoolId,
          requestId,
          decision,
          reason,
        )
      return reviewEnrollmentCorrection(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
        requestId,
        decision,
        reason,
      )
    },
  )
}
