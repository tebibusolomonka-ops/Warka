import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import type { EnrollmentService } from './enrollmentService.js'
import type { SchoolAccess } from './schoolAccess.js'
import { RecordNotFound, type SchoolStore } from './schoolService.js'
import { enrollmentResponse } from './studentRoutes.js'

const paramsSchema = z.object({
  schoolId: z.uuid(),
  enrollmentId: z.uuid(),
})

type Action = 'submit' | 'approve' | 'withdraw'

export function registerEnrollmentRoutes(
  app: FastifyInstance,
  getStore: () => SchoolStore,
  getAccess: () => SchoolAccess,
  getEnrollments: () => EnrollmentService,
  authenticate: preHandlerHookHandler,
) {
  async function requireAction(
    userId: string,
    schoolId: string,
    action: Action,
  ) {
    const school = await getStore().findSchoolById(schoolId)
    if (!school) throw new RecordNotFound('SCHOOL_NOT_FOUND')
    const access = getAccess()
    const allowed =
      action === 'submit'
        ? await access.canSubmitEnrollment(userId, school)
        : action === 'approve'
          ? await access.canApproveEnrollment(userId, school)
          : await access.canWithdrawEnrollment(userId, school)
    if (!allowed) throw new RecordNotFound('SCHOOL_NOT_FOUND')
  }

  app.post(
    '/schools/:schoolId/enrollments/:enrollmentId/submit',
    { preHandler: authenticate },
    async (request) => {
      const user = authenticatedUser(request)
      const { schoolId, enrollmentId } = paramsSchema.parse(request.params)
      await requireAction(user.id, schoolId, 'submit')
      return enrollmentResponse(
        await getEnrollments().submit(schoolId, enrollmentId),
      )
    },
  )

  app.post(
    '/schools/:schoolId/enrollments/:enrollmentId/approve',
    { preHandler: authenticate },
    async (request) => {
      const user = authenticatedUser(request)
      const { schoolId, enrollmentId } = paramsSchema.parse(request.params)
      await requireAction(user.id, schoolId, 'approve')
      return enrollmentResponse(
        await getEnrollments().approve(schoolId, enrollmentId, user.id),
      )
    },
  )

  app.post(
    '/schools/:schoolId/enrollments/:enrollmentId/withdraw',
    { preHandler: authenticate },
    async (request) => {
      const user = authenticatedUser(request)
      const { schoolId, enrollmentId } = paramsSchema.parse(request.params)
      await requireAction(user.id, schoolId, 'withdraw')
      return enrollmentResponse(
        await getEnrollments().withdraw(schoolId, enrollmentId, user.id),
      )
    },
  )
}
