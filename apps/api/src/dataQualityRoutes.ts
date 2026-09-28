import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  dismissDataQualityIssue,
  evaluateDataQuality,
  requireDataQualityAdministrator,
  type PrismaClient,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'

const school = z.strictObject({ schoolId: z.uuid() })
const issue = school.extend({ issueId: z.uuid() })
const query = z.strictObject({
  category: z
    .enum(['student', 'enrollment', 'academic', 'document'])
    .optional(),
  severity: z.enum(['info', 'warning', 'blocking']).optional(),
  status: z.enum(['open', 'resolved', 'dismissed']).optional(),
  cursor: z.uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).default(25),
})
const runBody = z.strictObject({
  checks: z
    .array(z.enum(['student', 'enrollment', 'academic', 'document']))
    .min(1)
    .max(4),
})
const dismissBody = z.strictObject({
  reason: z.string().trim().min(3).max(500),
})

export function registerDataQualityRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  const actor = (request: Parameters<typeof authenticatedUser>[0]) =>
    authenticatedUser(request).id
  app.post(
    '/schools/:schoolId/data-quality/runs',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      const { checks } = runBody.parse(request.body)
      const run = await evaluateDataQuality(
        getDatabase(),
        { schoolId, trigger: 'manual', checks },
        actor(request),
      )
      return reply.code(201).send(run)
    },
  )
  app.get(
    '/schools/:schoolId/data-quality/runs/latest',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = school.parse(request.params)
      await requireDataQualityAdministrator(
        getDatabase(),
        actor(request),
        schoolId,
      )
      return {
        run: await getDatabase().dataQualityRun.findFirst({
          where: { schoolId },
          orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        }),
      }
    },
  )
  app.get(
    '/schools/:schoolId/data-quality/issues',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = school.parse(request.params)
      await requireDataQualityAdministrator(
        getDatabase(),
        actor(request),
        schoolId,
      )
      const filters = query.parse(request.query)
      const rows = await getDatabase().dataQualityIssue.findMany({
        where: {
          schoolId,
          ...(filters.category ? { category: filters.category } : {}),
          ...(filters.severity ? { severity: filters.severity } : {}),
          ...(filters.status ? { status: filters.status } : {}),
        },
        select: {
          id: true,
          category: true,
          severity: true,
          code: true,
          status: true,
          summary: true,
          entityType: true,
          entityId: true,
          detectedAt: true,
          resolvedAt: true,
          dismissedAt: true,
          dismissalReason: true,
        },
        orderBy: [{ detectedAt: 'desc' }, { id: 'desc' }],
        take: filters.take + 1,
        ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      })
      return {
        issues: rows.slice(0, filters.take),
        nextCursor:
          rows.length > filters.take
            ? (rows[filters.take - 1]?.id ?? null)
            : null,
      }
    },
  )
  app.post(
    '/schools/:schoolId/data-quality/issues/:issueId/dismiss',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, issueId } = issue.parse(request.params)
      const { reason } = dismissBody.parse(request.body)
      return dismissDataQualityIssue(getDatabase(), actor(request), {
        schoolId,
        issueId,
        reason,
      })
    },
  )
}
