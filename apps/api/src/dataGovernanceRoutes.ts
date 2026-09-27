import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  createRetentionHold,
  listRetentionHolds,
  releaseRetentionHold,
  requirePrivacyReviewer,
  RetentionPermissionError,
  type PrismaClient,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'

const schoolParams = z.strictObject({ schoolId: z.uuid() })
const organizationParams = z.strictObject({ organizationId: z.uuid() })
const holdParams = organizationParams.extend({ holdId: z.uuid() })
const holdBody = z.strictObject({
  scope: z.enum(['student', 'privacyRequest', 'issuedDocument']),
  recordId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
})

export function registerDataGovernanceRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/schools/:schoolId/data-governance/summary',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      const { organizationId } = await requirePrivacyReviewer(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
      )
      const [openRequests, statuses, restrictions, corrections, staffChanges] =
        await Promise.all([
          getDatabase().privacyRequest.count({
            where: {
              schoolId,
              status: { in: ['submitted', 'underReview', 'approved'] },
            },
          }),
          getDatabase().privacyRequest.groupBy({
            by: ['status'],
            where: { schoolId },
            _count: { _all: true },
          }),
          getDatabase().processingRestriction.count({
            where: { schoolId, status: 'active' },
          }),
          getDatabase().studentCorrectionRequest.findMany({
            where: { schoolId },
            orderBy: { requestedAt: 'desc' },
            take: 5,
            select: { id: true, status: true, requestedAt: true, field: true },
          }),
          getDatabase().auditEvent.findMany({
            where: {
              schoolId,
              action: {
                in: [
                  'schoolStaff.offboarded',
                  'account.lifecycleChanged',
                  'membership.changed',
                ],
              },
            },
            orderBy: { occurredAt: 'desc' },
            take: 5,
            select: { id: true, action: true, occurredAt: true },
          }),
        ])
      return {
        organizationId,
        schoolId,
        openRequests,
        statuses: statuses.map((item) => ({
          status: item.status,
          count: item._count._all,
        })),
        activeRestrictions: restrictions,
        recentCorrections: corrections,
        recentStaffChanges: staffChanges,
      }
    },
  )
  app.get(
    '/governance/:organizationId/retention/holds',
    { preHandler: authenticate },
    (request) => {
      const { organizationId } = organizationParams.parse(request.params)
      return listRetentionHolds(
        getDatabase(),
        authenticatedUser(request).id,
        organizationId,
      )
    },
  )
  app.post(
    '/governance/:organizationId/retention/holds',
    { preHandler: authenticate },
    (request) => {
      const { organizationId } = organizationParams.parse(request.params)
      return createRetentionHold(getDatabase(), authenticatedUser(request).id, {
        ...holdBody.parse(request.body),
        organizationId,
      })
    },
  )
  app.post(
    '/governance/:organizationId/retention/holds/:holdId/release',
    { preHandler: authenticate },
    async (request) => {
      const { organizationId, holdId } = holdParams.parse(request.params)
      const hold = await getDatabase().retentionHold.findUnique({
        where: { id: holdId },
        select: { organizationId: true },
      })
      if (!hold || hold.organizationId !== organizationId)
        throw new RetentionPermissionError()
      return releaseRetentionHold(
        getDatabase(),
        authenticatedUser(request).id,
        holdId,
      )
    },
  )
}
