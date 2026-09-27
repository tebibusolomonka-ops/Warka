import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  applyProcessingRestriction,
  cancelOwnPrivacyRequest,
  createPrivacyRequest,
  endProcessingRestriction,
  fulfillPrivacyAccessRequest,
  listOwnPrivacyRequests,
  privacyRequesterScope,
  PrivacyPermissionError,
  requirePrivacyReviewer,
  reviewPrivacyRequest,
  type PrismaClient,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'

const schoolParams = z.strictObject({ schoolId: z.uuid() })
const requestParams = z.strictObject({ requestId: z.uuid() })
const schoolRequestParams = schoolParams.extend({ requestId: z.uuid() })
const actionParams = schoolRequestParams.extend({
  action: z.enum([
    'review',
    'approve',
    'reject',
    'fulfill',
    'applyRestriction',
  ]),
})
const restrictionParams = schoolParams.extend({ restrictionId: z.uuid() })
const pageQuery = z.strictObject({
  take: z.coerce.number().int().min(1).max(50).default(25),
  skip: z.coerce.number().int().min(0).max(100000).default(0),
})
const staffQuery = pageQuery.extend({
  status: z
    .enum([
      'submitted',
      'underReview',
      'approved',
      'rejected',
      'fulfilled',
      'cancelled',
    ])
    .optional(),
})
const submitBody = z.strictObject({
  studentId: z.uuid(),
  type: z.enum(['access', 'correction', 'restriction', 'objection']),
  details: z.string().trim().min(3).max(1000),
  correctionField: z
    .enum(['givenName', 'familyName', 'dateOfBirth'])
    .optional(),
  correctionValue: z.string().trim().max(100).nullable().optional(),
  restrictionCategory: z
    .enum(['parentPortalSharing', 'publicDocumentVerification'])
    .optional(),
})
const decisionBody = z.strictObject({
  reason: z.string().trim().min(3).max(500).optional(),
})

export function registerPrivacyRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.post(
    '/schools/:schoolId/privacy/requests',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = schoolParams.parse(request.params)
      const body = submitBody.parse(request.body)
      return reply
        .code(201)
        .send(
          await createPrivacyRequest(
            getDatabase(),
            authenticatedUser(request).id,
            { ...body, schoolId },
          ),
        )
    },
  )
  app.get(
    '/privacy/requests/mine',
    { preHandler: authenticate },
    async (request) => {
      const { take, skip } = pageQuery.parse(request.query)
      const page = await listOwnPrivacyRequests(
        getDatabase(),
        authenticatedUser(request).id,
        take,
        skip,
      )
      return page
    },
  )
  app.get(
    '/privacy/requests/:requestId',
    { preHandler: authenticate },
    async (request) => {
      const { requestId } = requestParams.parse(request.params)
      const userId = authenticatedUser(request).id
      const item = await getDatabase().privacyRequest.findFirst({
        where: { id: requestId, requesterUserId: userId },
      })
      if (!item) throw new PrivacyPermissionError()
      await privacyRequesterScope(
        getDatabase(),
        userId,
        item.studentId,
        item.schoolId,
      )
      const { accessPackage, ...safe } = item
      return {
        ...safe,
        accessPackage: item.status === 'fulfilled' ? accessPackage : null,
      }
    },
  )
  app.post(
    '/privacy/requests/:requestId/cancel',
    { preHandler: authenticate },
    async (request) => {
      const { requestId } = requestParams.parse(request.params)
      return cancelOwnPrivacyRequest(
        getDatabase(),
        authenticatedUser(request).id,
        requestId,
      )
    },
  )
  app.get(
    '/schools/:schoolId/privacy/requests',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      const { take, skip, status } = staffQuery.parse(request.query)
      await requirePrivacyReviewer(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
      )
      const where = { schoolId, ...(status ? { status } : {}) }
      const [total, items] = await Promise.all([
        getDatabase().privacyRequest.count({ where }),
        getDatabase().privacyRequest.findMany({
          where,
          take,
          skip,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            schoolId: true,
            studentId: true,
            requesterKind: true,
            requester: { select: { displayName: true } },
            type: true,
            status: true,
            details: true,
            correctionField: true,
            correctionValue: true,
            restrictionCategory: true,
            officialCorrectionRequestId: true,
            createdAt: true,
            reviewedAt: true,
            reviewReason: true,
            fulfilledAt: true,
          },
        }),
      ])
      return { total, items, take, skip }
    },
  )
  app.post(
    '/schools/:schoolId/privacy/requests/:requestId/:action',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, requestId, action } = actionParams.parse(request.params)
      const { reason } = decisionBody.parse(request.body ?? {})
      const item = await getDatabase().privacyRequest.findUnique({
        where: { id: requestId },
        select: { schoolId: true },
      })
      if (!item || item.schoolId !== schoolId)
        throw new PrivacyPermissionError()
      const actor = authenticatedUser(request).id
      if (action === 'fulfill')
        return fulfillPrivacyAccessRequest(getDatabase(), actor, requestId)
      if (action === 'applyRestriction')
        return applyProcessingRestriction(getDatabase(), actor, requestId)
      return reviewPrivacyRequest(
        getDatabase(),
        actor,
        requestId,
        action,
        reason,
      )
    },
  )
  app.get(
    '/schools/:schoolId/privacy/restrictions',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      const { take, skip } = pageQuery.parse(request.query)
      await requirePrivacyReviewer(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
      )
      const where = { schoolId }
      return {
        total: await getDatabase().processingRestriction.count({ where }),
        items: await getDatabase().processingRestriction.findMany({
          where,
          take,
          skip,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            studentId: true,
            category: true,
            status: true,
            effectiveAt: true,
            endedAt: true,
            createdAt: true,
          },
        }),
        take,
        skip,
      }
    },
  )
  app.post(
    '/schools/:schoolId/privacy/restrictions/:restrictionId/end',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, restrictionId } = restrictionParams.parse(
        request.params,
      )
      const restriction = await getDatabase().processingRestriction.findUnique({
        where: { id: restrictionId },
        select: { schoolId: true },
      })
      if (!restriction || restriction.schoolId !== schoolId)
        throw new PrivacyPermissionError()
      return endProcessingRestriction(
        getDatabase(),
        authenticatedUser(request).id,
        restrictionId,
      )
    },
  )
}
