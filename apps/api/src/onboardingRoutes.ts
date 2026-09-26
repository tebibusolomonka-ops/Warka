import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'
import type { OnboardingService } from './onboardingService.js'

const school = z.strictObject({ schoolId: z.uuid() })
const item = z.strictObject({ schoolId: z.uuid(), key: z.string() })
const record = z.strictObject({ schoolId: z.uuid(), recordId: z.uuid() })
export function registerOnboardingRoutes(
  app: FastifyInstance,
  getService: () => OnboardingService,
  authenticate: preHandlerHookHandler,
) {
  const context = (request: { params: unknown; currentUser: unknown }) => ({
    ...school.parse(request.params),
    actorId: authenticatedUser(
      request as Parameters<typeof authenticatedUser>[0],
    ).id,
  })
  app.get(
    '/schools/:schoolId/onboarding',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, actorId } = context(request)
      return getService().state(actorId, schoolId)
    },
  )
  app.post(
    '/schools/:schoolId/onboarding/start',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, actorId } = context(request)
      return getService().start(actorId, schoolId)
    },
  )
  app.post(
    '/schools/:schoolId/onboarding/pause',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, actorId } = context(request)
      return getService().pause(actorId, schoolId)
    },
  )
  app.get(
    '/schools/:schoolId/onboarding/checklist',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, actorId } = context(request)
      return getService().checklist(actorId, schoolId)
    },
  )
  app.put(
    '/schools/:schoolId/onboarding/checklist/:key',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, key } = item.parse(request.params)
      const { status } = z
        .strictObject({
          status: z.enum(['pending', 'complete', 'notApplicable']),
        })
        .parse(request.body)
      return getService().updateManual(
        authenticatedUser(request).id,
        schoolId,
        key,
        status,
      )
    },
  )
  app.get(
    '/schools/:schoolId/onboarding/readiness',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, actorId } = context(request)
      return getService().readiness(actorId, schoolId)
    },
  )
  app.get(
    '/schools/:schoolId/onboarding/training',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, actorId } = context(request)
      return getService().training(actorId, schoolId)
    },
  )
  app.post(
    '/schools/:schoolId/onboarding/training',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, actorId } = context(request)
      const { userId, trainingType } = z
        .strictObject({
          userId: z.uuid(),
          trainingType: z.enum([
            'schoolAdministration',
            'studentRegistration',
            'academicResults',
            'documentProcessing',
          ]),
        })
        .parse(request.body)
      return getService().assignTraining(
        actorId,
        schoolId,
        userId,
        trainingType,
      )
    },
  )
  app.post(
    '/schools/:schoolId/onboarding/training/:recordId/finish',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, recordId } = record.parse(request.params)
      const { action, reason } = z
        .strictObject({
          action: z.enum(['completed', 'waived']),
          reason: z.string().optional(),
        })
        .parse(request.body)
      return getService().finishTraining(
        authenticatedUser(request).id,
        schoolId,
        recordId,
        action,
        reason,
      )
    },
  )
  app.post(
    '/schools/:schoolId/onboarding/submit',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, actorId } = context(request)
      return getService().submit(actorId, schoolId)
    },
  )
  app.post(
    '/schools/:schoolId/onboarding/complete',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, actorId } = context(request)
      return getService().complete(actorId, schoolId)
    },
  )
}
