import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  BulkDecisionSchema,
  BulkPromotionSchema,
  UpdateProgressionEntrySchema,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'
import type { AcademicRolloverService } from './academicRolloverService.js'

const yearParams = z.strictObject({ schoolId: z.uuid(), yearId: z.uuid() })
const schoolParams = z.strictObject({ schoolId: z.uuid() })
const planParams = z.strictObject({ schoolId: z.uuid(), planId: z.uuid() })
const entryParams = z.strictObject({
  schoolId: z.uuid(),
  planId: z.uuid(),
  entryId: z.uuid(),
})
const exceptionParams = z.strictObject({
  schoolId: z.uuid(),
  planId: z.uuid(),
  exceptionId: z.uuid(),
})
const createBody = z.strictObject({
  sourceAcademicYearId: z.uuid(),
  targetAcademicYearId: z.uuid(),
})
const resolutionBody = z.strictObject({
  note: z.string().trim().min(3).max(500),
})

export function registerAcademicRolloverRoutes(
  app: FastifyInstance,
  getRollover: () => AcademicRolloverService,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/schools/:schoolId/years/:yearId/closing-readiness',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, yearId } = yearParams.parse(request.params)
      return getRollover().readiness(
        authenticatedUser(request).id,
        schoolId,
        yearId,
      )
    },
  )
  app.post(
    '/schools/:schoolId/years/:yearId/closing/start',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, yearId } = yearParams.parse(request.params)
      return getRollover().startClosing(
        authenticatedUser(request).id,
        schoolId,
        yearId,
      )
    },
  )
  app.post(
    '/schools/:schoolId/years/:yearId/closing/complete',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, yearId } = yearParams.parse(request.params)
      return getRollover().completeClosing(
        authenticatedUser(request).id,
        schoolId,
        yearId,
      )
    },
  )
  app.get(
    '/schools/:schoolId/progression-plans',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      return {
        plans: await getRollover().listPlans(
          authenticatedUser(request).id,
          schoolId,
        ),
      }
    },
  )
  app.post(
    '/schools/:schoolId/progression-plans',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = schoolParams.parse(request.params)
      const body = createBody.parse(request.body)
      return reply.code(201).send(
        await getRollover().createPlan(authenticatedUser(request).id, {
          schoolId,
          ...body,
        }),
      )
    },
  )
  app.get(
    '/schools/:schoolId/progression-plans/:planId',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, planId } = planParams.parse(request.params)
      const plan = await getRollover().getPlan(
        authenticatedUser(request).id,
        schoolId,
        planId,
      )
      return (
        plan ??
        reply.code(404).send({
          error: {
            code: 'PLAN_NOT_FOUND',
            message: 'Progression plan not found',
          },
        })
      )
    },
  )
  app.get(
    '/schools/:schoolId/progression-plans/:planId/entries',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, planId } = planParams.parse(request.params)
      const plan = await getRollover().getPlan(
        authenticatedUser(request).id,
        schoolId,
        planId,
      )
      return plan
        ? { entries: plan.entries }
        : reply.code(404).send({
            error: {
              code: 'PLAN_NOT_FOUND',
              message: 'Progression plan not found',
            },
          })
    },
  )
  app.put(
    '/schools/:schoolId/progression-plans/:planId/entries/:entryId',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, planId, entryId } = entryParams.parse(request.params)
      return getRollover().updateEntry(
        authenticatedUser(request).id,
        schoolId,
        planId,
        entryId,
        UpdateProgressionEntrySchema.parse(request.body),
      )
    },
  )
  app.post(
    '/schools/:schoolId/progression-plans/:planId/bulk-promotions',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, planId } = planParams.parse(request.params)
      return getRollover().bulkPromote(
        authenticatedUser(request).id,
        schoolId,
        planId,
        BulkPromotionSchema.parse(request.body),
      )
    },
  )
  app.post(
    '/schools/:schoolId/progression-plans/:planId/bulk-decisions',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, planId } = planParams.parse(request.params)
      return getRollover().bulkDecide(
        authenticatedUser(request).id,
        schoolId,
        planId,
        BulkDecisionSchema.parse(request.body),
      )
    },
  )
  app.get(
    '/schools/:schoolId/progression-plans/:planId/preview',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, planId } = planParams.parse(request.params)
      return getRollover().preview(
        authenticatedUser(request).id,
        schoolId,
        planId,
      )
    },
  )
  app.post(
    '/schools/:schoolId/progression-plans/:planId/review',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, planId } = planParams.parse(request.params)
      return getRollover().review(
        authenticatedUser(request).id,
        schoolId,
        planId,
      )
    },
  )
  app.post(
    '/schools/:schoolId/progression-plans/:planId/apply',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, planId } = planParams.parse(request.params)
      return getRollover().apply(
        authenticatedUser(request).id,
        schoolId,
        planId,
      )
    },
  )
  app.get(
    '/schools/:schoolId/progression-plans/:planId/exceptions',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, planId } = planParams.parse(request.params)
      return {
        exceptions: await getRollover().listExceptions(
          authenticatedUser(request).id,
          schoolId,
          planId,
        ),
      }
    },
  )
  app.post(
    '/schools/:schoolId/progression-plans/:planId/exceptions/refresh',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, planId } = planParams.parse(request.params)
      return {
        exceptions: await getRollover().refreshExceptions(
          authenticatedUser(request).id,
          schoolId,
          planId,
        ),
      }
    },
  )
  app.post(
    '/schools/:schoolId/progression-plans/:planId/exceptions/:exceptionId/resolve',
    { preHandler: authenticate },
    (request) => {
      const { schoolId, planId, exceptionId } = exceptionParams.parse(
        request.params,
      )
      const { note } = resolutionBody.parse(request.body)
      return getRollover().resolveException(
        authenticatedUser(request).id,
        schoolId,
        planId,
        exceptionId,
        note,
      )
    },
  )
}
