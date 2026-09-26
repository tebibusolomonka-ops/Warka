import {
  type AccessReviewDecision,
  type AccessReviewEntry,
  type Prisma,
  type PrismaClient,
} from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'

export class AccessReviewPermissionError extends Error {
  constructor() {
    super('Access review permission denied')
  }
}

export class AccessReviewStateError extends Error {
  constructor(message = 'Access review cannot change from its current state') {
    super(message)
  }
}

export const AccessReviewScopeSchema = z.strictObject({
  organizationId: z.uuid(),
  schoolId: z.uuid().optional(),
})

export const AccessReviewDecisionSchema = z.enum(['confirmed', 'revoke'])

async function requireAccessReviewAuthority(
  database: PrismaClient,
  actorUserId: string,
  organizationId: string,
  schoolId?: string,
) {
  const organizationMembership =
    await database.organizationMembership.findUnique({
      where: {
        userId_organizationId: { userId: actorUserId, organizationId },
      },
    })
  if (
    organizationMembership &&
    ['owner', 'administrator'].includes(organizationMembership.role)
  )
    return
  if (schoolId) {
    const [school, schoolMembership] = await Promise.all([
      database.school.findFirst({ where: { id: schoolId, organizationId } }),
      database.schoolMembership.findUnique({
        where: { userId_schoolId: { userId: actorUserId, schoolId } },
      }),
    ])
    if (school && schoolMembership?.role === 'administrator') return
  }
  throw new AccessReviewPermissionError()
}

function entryData(
  accessReviewId: string,
  organizationId: string,
  input: {
    userId: string
    accessType: 'organizationMembership' | 'schoolMembership' | 'bureauAccess'
    currentRole: string
    schoolId?: string
    sourceId?: string
  },
): Prisma.AccessReviewEntryCreateManyInput {
  return {
    accessReviewId,
    organizationId,
    userId: input.userId,
    accessType: input.accessType,
    currentRole: input.currentRole,
    ...(input.schoolId ? { schoolId: input.schoolId } : {}),
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
  }
}

export async function startAccessReview(
  database: PrismaClient,
  actorUserId: string,
  input: unknown,
) {
  z.uuid().parse(actorUserId)
  const scope = AccessReviewScopeSchema.parse(input)
  await requireAccessReviewAuthority(
    database,
    actorUserId,
    scope.organizationId,
    scope.schoolId,
  )
  return database.$transaction(async (transaction) => {
    const review = await transaction.accessReview.create({
      data: {
        organizationId: scope.organizationId,
        ...(scope.schoolId ? { schoolId: scope.schoolId } : {}),
        startedById: actorUserId,
      },
    })
    const [organizationMemberships, schoolMemberships, bureauAccesses] =
      await Promise.all([
        scope.schoolId
          ? Promise.resolve([])
          : transaction.organizationMembership.findMany({
              where: { organizationId: scope.organizationId },
            }),
        transaction.schoolMembership.findMany({
          where: scope.schoolId
            ? { schoolId: scope.schoolId }
            : { school: { organizationId: scope.organizationId } },
        }),
        scope.schoolId
          ? Promise.resolve([])
          : transaction.bureauAccess.findMany({
              where: {
                organizationId: scope.organizationId,
                revokedAt: null,
              },
            }),
      ])
    const entries = [
      ...organizationMemberships.map((membership) =>
        entryData(review.id, scope.organizationId, {
          userId: membership.userId,
          accessType: 'organizationMembership',
          currentRole: membership.role,
        }),
      ),
      ...schoolMemberships.map((membership) =>
        entryData(review.id, scope.organizationId, {
          userId: membership.userId,
          accessType: 'schoolMembership',
          currentRole: membership.role,
          schoolId: membership.schoolId,
        }),
      ),
      ...bureauAccesses.map((access) =>
        entryData(review.id, scope.organizationId, {
          userId: access.userId,
          accessType: 'bureauAccess',
          currentRole: access.role,
          sourceId: access.id,
        }),
      ),
    ]
    if (entries.length)
      await transaction.accessReviewEntry.createMany({ data: entries })
    await recordAuditEvent(transaction, {
      organizationId: scope.organizationId,
      ...(scope.schoolId ? { schoolId: scope.schoolId } : {}),
      actorUserId,
      action: 'accessReview.started',
      resourceType: 'accessReview',
      resourceId: review.id,
      metadata: { assignmentCount: entries.length },
    })
    return transaction.accessReview.findUniqueOrThrow({
      where: { id: review.id },
      include: { entries: { orderBy: { id: 'asc' } } },
    })
  })
}

export async function setAccessReviewDecision(
  database: PrismaClient,
  actorUserId: string,
  reviewId: string,
  entryId: string,
  decision: unknown,
) {
  z.uuid().parse(reviewId)
  z.uuid().parse(entryId)
  const checkedDecision = AccessReviewDecisionSchema.parse(decision)
  const review = await database.accessReview.findUniqueOrThrow({
    where: { id: reviewId },
  })
  await requireAccessReviewAuthority(
    database,
    actorUserId,
    review.organizationId,
    review.schoolId ?? undefined,
  )
  if (review.status !== 'open') throw new AccessReviewStateError()
  const changed = await database.accessReviewEntry.updateMany({
    where: { id: entryId, accessReviewId: reviewId },
    data: {
      decision: checkedDecision,
      decidedById: actorUserId,
      decidedAt: new Date(),
    },
  })
  if (changed.count !== 1) throw new AccessReviewStateError('Entry not found')
  return database.accessReviewEntry.findUniqueOrThrow({
    where: { id: entryId },
  })
}

async function applyRevocation(
  transaction: Prisma.TransactionClient,
  entry: AccessReviewEntry,
  completedAt: Date,
) {
  if (entry.accessType === 'organizationMembership')
    await transaction.organizationMembership.deleteMany({
      where: {
        userId: entry.userId,
        organizationId: entry.organizationId,
        role: entry.currentRole as 'owner' | 'administrator',
      },
    })
  if (entry.accessType === 'schoolMembership' && entry.schoolId)
    await transaction.schoolMembership.deleteMany({
      where: {
        userId: entry.userId,
        schoolId: entry.schoolId,
        role: entry.currentRole as
          'administrator' | 'registrar' | 'teacher' | 'approver',
      },
    })
  if (entry.accessType === 'bureauAccess' && entry.sourceId)
    await transaction.bureauAccess.updateMany({
      where: {
        id: entry.sourceId,
        userId: entry.userId,
        organizationId: entry.organizationId,
        role: entry.currentRole as 'viewer' | 'reportManager',
        revokedAt: null,
      },
      data: { revokedAt: completedAt },
    })
}

export async function completeAccessReview(
  database: PrismaClient,
  actorUserId: string,
  reviewId: string,
) {
  z.uuid().parse(reviewId)
  const review = await database.accessReview.findUniqueOrThrow({
    where: { id: reviewId },
    include: { entries: true },
  })
  await requireAccessReviewAuthority(
    database,
    actorUserId,
    review.organizationId,
    review.schoolId ?? undefined,
  )
  if (review.status !== 'open') throw new AccessReviewStateError()
  if (review.entries.some((entry) => entry.decision === 'pending'))
    throw new AccessReviewStateError('Every assignment requires a decision')
  const completedAt = new Date()
  return database.$transaction(async (transaction) => {
    for (const entry of review.entries)
      if (entry.decision === 'revoke')
        await applyRevocation(transaction, entry, completedAt)
    const completed = await transaction.accessReview.update({
      where: { id: reviewId, status: 'open' },
      data: {
        status: 'completed',
        completedAt,
        completedById: actorUserId,
      },
      include: { entries: { orderBy: { id: 'asc' } } },
    })
    await recordAuditEvent(transaction, {
      organizationId: review.organizationId,
      ...(review.schoolId ? { schoolId: review.schoolId } : {}),
      actorUserId,
      action: 'accessReview.completed',
      resourceType: 'accessReview',
      resourceId: reviewId,
      metadata: {
        confirmed: review.entries.filter(
          (entry) => entry.decision === 'confirmed',
        ).length,
        revoked: review.entries.filter((entry) => entry.decision === 'revoke')
          .length,
      },
    })
    return completed
  })
}

export async function listAccessReviews(
  database: PrismaClient,
  actorUserId: string,
  input: unknown,
) {
  const scope = AccessReviewScopeSchema.parse(input)
  await requireAccessReviewAuthority(
    database,
    actorUserId,
    scope.organizationId,
    scope.schoolId,
  )
  return database.accessReview.findMany({
    where: {
      organizationId: scope.organizationId,
      ...(scope.schoolId ? { schoolId: scope.schoolId } : {}),
    },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    take: 100,
  })
}

export async function getAccessReview(
  database: PrismaClient,
  actorUserId: string,
  reviewId: string,
) {
  const review = await database.accessReview.findUniqueOrThrow({
    where: { id: z.uuid().parse(reviewId) },
    include: { entries: { orderBy: { id: 'asc' } } },
  })
  await requireAccessReviewAuthority(
    database,
    actorUserId,
    review.organizationId,
    review.schoolId ?? undefined,
  )
  return review
}

export type { AccessReview, AccessReviewEntry } from '@prisma/client'
export type ReviewDecision = AccessReviewDecision
