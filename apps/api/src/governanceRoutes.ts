import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import {
  AccessReviewDecisionSchema,
  approveSupportAccess,
  AuditActionSchema,
  AuditResourceTypeSchema,
  completeAccessReview,
  createRetentionPolicy,
  evaluateRetention,
  getAccessReview,
  hasOrganizationAdminRole,
  listAccessReviews,
  listAuditEvents,
  listRetentionPolicies,
  listSupportAccessGrants,
  listSupportIdentities,
  requestSupportAccess,
  RetentionCategorySchema,
  revokeSupportAccess,
  setAccessReviewDecision,
  startAccessReview,
  type PrismaClient,
} from '@warka/database'
import { z } from 'zod'
import { authenticatedUser } from './authenticateRequest.js'

export class GovernancePermissionError extends Error {
  constructor() {
    super('Governance permission denied')
  }
}

const OrganizationParams = z.strictObject({ organizationId: z.uuid() })
const ReviewParams = z.strictObject({
  organizationId: z.uuid(),
  reviewId: z.uuid(),
})
const EntryParams = z.strictObject({
  organizationId: z.uuid(),
  reviewId: z.uuid(),
  entryId: z.uuid(),
})
const GrantParams = z.strictObject({
  organizationId: z.uuid(),
  grantId: z.uuid(),
})
const RetentionParams = z.strictObject({
  organizationId: z.uuid(),
  category: RetentionCategorySchema,
})

async function requireOrganizationAdministrator(
  database: PrismaClient,
  actorUserId: string,
  organizationId: string,
) {
  if (!(await hasOrganizationAdminRole(database, actorUserId, organizationId)))
    throw new GovernancePermissionError()
}

async function requireSchoolAuditAdministrator(
  database: PrismaClient,
  actorUserId: string,
  organizationId: string,
  schoolId: string,
) {
  if (await hasOrganizationAdminRole(database, actorUserId, organizationId))
    return
  const [school, membership] = await Promise.all([
    database.school.findFirst({ where: { id: schoolId, organizationId } }),
    database.schoolMembership.findUnique({
      where: { userId_schoolId: { userId: actorUserId, schoolId } },
    }),
  ])
  if (!school || membership?.role !== 'administrator')
    throw new GovernancePermissionError()
}

async function withEntryUsers(
  database: PrismaClient,
  review: Awaited<ReturnType<typeof getAccessReview>>,
) {
  const users = await database.user.findMany({
    where: { id: { in: review.entries.map((entry) => entry.userId) } },
    select: { id: true, displayName: true, email: true },
  })
  const userById = new Map(users.map((user) => [user.id, user]))
  return {
    ...review,
    entries: review.entries.map((entry) => ({
      ...entry,
      user: userById.get(entry.userId) ?? null,
    })),
  }
}

export function registerGovernanceRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  app.get(
    '/governance/:organizationId/audit',
    { preHandler: authenticate },
    async (request) => {
      const { organizationId } = OrganizationParams.parse(request.params)
      const query = z
        .strictObject({
          schoolId: z.uuid().optional(),
          action: AuditActionSchema.optional(),
          resourceType: AuditResourceTypeSchema.optional(),
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
          take: z.coerce.number().int().min(1).max(100).optional(),
          cursor: z.uuid().optional(),
        })
        .parse(request.query)
      const actorUserId = authenticatedUser(request).id
      if (query.schoolId)
        await requireSchoolAuditAdministrator(
          getDatabase(),
          actorUserId,
          organizationId,
          query.schoolId,
        )
      else
        await requireOrganizationAdministrator(
          getDatabase(),
          actorUserId,
          organizationId,
        )
      return listAuditEvents(getDatabase(), {
        organizationId,
        ...(query.schoolId ? { schoolId: query.schoolId } : {}),
        ...(query.action ? { action: query.action } : {}),
        ...(query.resourceType ? { resourceType: query.resourceType } : {}),
        ...(query.from ? { from: query.from } : {}),
        ...(query.to ? { to: query.to } : {}),
        ...(query.take ? { take: query.take } : {}),
        ...(query.cursor ? { cursor: query.cursor } : {}),
      })
    },
  )

  app.get(
    '/governance/:organizationId/reviews',
    { preHandler: authenticate },
    (request) => {
      const { organizationId } = OrganizationParams.parse(request.params)
      const query = z
        .strictObject({ schoolId: z.uuid().optional() })
        .parse(request.query)
      return listAccessReviews(getDatabase(), authenticatedUser(request).id, {
        organizationId,
        ...query,
      })
    },
  )
  app.post(
    '/governance/:organizationId/reviews',
    { preHandler: authenticate },
    (request) => {
      const { organizationId } = OrganizationParams.parse(request.params)
      const body = z
        .strictObject({ schoolId: z.uuid().optional() })
        .parse(request.body)
      return startAccessReview(getDatabase(), authenticatedUser(request).id, {
        organizationId,
        ...body,
      })
    },
  )
  app.get(
    '/governance/:organizationId/reviews/:reviewId',
    { preHandler: authenticate },
    async (request) => {
      const { organizationId, reviewId } = ReviewParams.parse(request.params)
      const review = await getAccessReview(
        getDatabase(),
        authenticatedUser(request).id,
        reviewId,
      )
      if (review.organizationId !== organizationId)
        throw new GovernancePermissionError()
      return withEntryUsers(getDatabase(), review)
    },
  )
  app.patch(
    '/governance/:organizationId/reviews/:reviewId/entries/:entryId',
    { preHandler: authenticate },
    (request) => {
      const { reviewId, entryId } = EntryParams.parse(request.params)
      const { decision } = z
        .strictObject({ decision: AccessReviewDecisionSchema })
        .parse(request.body)
      return setAccessReviewDecision(
        getDatabase(),
        authenticatedUser(request).id,
        reviewId,
        entryId,
        decision,
      )
    },
  )
  app.post(
    '/governance/:organizationId/reviews/:reviewId/complete',
    { preHandler: authenticate },
    (request) => {
      const { reviewId } = ReviewParams.parse(request.params)
      return completeAccessReview(
        getDatabase(),
        authenticatedUser(request).id,
        reviewId,
      )
    },
  )

  app.get(
    '/governance/:organizationId/support/identities',
    { preHandler: authenticate },
    async (request) => {
      const { organizationId } = OrganizationParams.parse(request.params)
      const { schoolId } = z
        .strictObject({ schoolId: z.uuid() })
        .parse(request.query)
      await requireSchoolAuditAdministrator(
        getDatabase(),
        authenticatedUser(request).id,
        organizationId,
        schoolId,
      )
      return listSupportIdentities(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
      )
    },
  )
  app.get(
    '/governance/:organizationId/support/grants',
    { preHandler: authenticate },
    async (request) => {
      const { organizationId } = OrganizationParams.parse(request.params)
      const { schoolId } = z
        .strictObject({ schoolId: z.uuid() })
        .parse(request.query)
      await requireSchoolAuditAdministrator(
        getDatabase(),
        authenticatedUser(request).id,
        organizationId,
        schoolId,
      )
      const grants = await listSupportAccessGrants(
        getDatabase(),
        authenticatedUser(request).id,
        schoolId,
      )
      const users = await getDatabase().user.findMany({
        where: { id: { in: grants.map((grant) => grant.supportUserId) } },
        select: { id: true, displayName: true, email: true },
      })
      const userById = new Map(users.map((user) => [user.id, user]))
      return grants.map((grant) => ({
        ...grant,
        supportUser: userById.get(grant.supportUserId) ?? null,
      }))
    },
  )
  app.post(
    '/governance/:organizationId/support/grants',
    { preHandler: authenticate },
    (request) => {
      const { organizationId } = OrganizationParams.parse(request.params)
      const body = z
        .strictObject({
          supportUserId: z.uuid(),
          schoolId: z.uuid(),
          reason: z.string(),
          expiresAt: z.coerce.date(),
        })
        .parse(request.body)
      return requireSchoolAuditAdministrator(
        getDatabase(),
        authenticatedUser(request).id,
        organizationId,
        body.schoolId,
      ).then(() =>
        requestSupportAccess(
          getDatabase(),
          authenticatedUser(request).id,
          body,
        ),
      )
    },
  )
  for (const action of ['approve', 'revoke'] as const)
    app.post(
      `/governance/:organizationId/support/grants/:grantId/${action}`,
      { preHandler: authenticate },
      (request) => {
        const { grantId } = GrantParams.parse(request.params)
        return action === 'approve'
          ? approveSupportAccess(
              getDatabase(),
              authenticatedUser(request).id,
              grantId,
            )
          : revokeSupportAccess(
              getDatabase(),
              authenticatedUser(request).id,
              grantId,
            )
      },
    )

  app.get(
    '/governance/:organizationId/retention',
    { preHandler: authenticate },
    (request) => {
      const { organizationId } = OrganizationParams.parse(request.params)
      return listRetentionPolicies(
        getDatabase(),
        authenticatedUser(request).id,
        organizationId,
      )
    },
  )
  app.put(
    '/governance/:organizationId/retention/:category',
    { preHandler: authenticate },
    (request) => {
      const { organizationId, category } = RetentionParams.parse(request.params)
      const { retentionDays } = z
        .strictObject({ retentionDays: z.number().int() })
        .parse(request.body)
      return createRetentionPolicy(
        getDatabase(),
        authenticatedUser(request).id,
        { organizationId, category, retentionDays },
      )
    },
  )
  app.post(
    '/governance/:organizationId/retention/:category/evaluate',
    { preHandler: authenticate },
    (request) => {
      const { organizationId, category } = RetentionParams.parse(request.params)
      return evaluateRetention(
        getDatabase(),
        authenticatedUser(request).id,
        organizationId,
        category,
      )
    },
  )
}
