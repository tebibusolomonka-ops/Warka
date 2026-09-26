import type { PrismaClient, RetentionCategory } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'

export const RetentionCategorySchema = z.enum([
  'messages',
  'auditEvents',
  'issuedDocuments',
  'academicRecords',
  'enrollmentRecords',
])

export const SaveRetentionPolicySchema = z.strictObject({
  organizationId: z.uuid(),
  category: RetentionCategorySchema,
  retentionDays: z.number().int().min(1).max(36_500),
})

export class RetentionPermissionError extends Error {
  constructor() {
    super('Retention policy permission denied')
  }
}

export class RetentionPolicyNotFoundError extends Error {
  constructor() {
    super('Retention policy is not configured')
  }
}

async function requireRetentionAdministrator(
  database: PrismaClient,
  actorUserId: string,
  organizationId: string,
) {
  const membership = await database.organizationMembership.findUnique({
    where: {
      userId_organizationId: { userId: actorUserId, organizationId },
    },
  })
  if (!membership || !['owner', 'administrator'].includes(membership.role))
    throw new RetentionPermissionError()
}

export async function createRetentionPolicy(
  database: PrismaClient,
  actorUserId: string,
  input: unknown,
) {
  const data = SaveRetentionPolicySchema.parse(input)
  await requireRetentionAdministrator(
    database,
    actorUserId,
    data.organizationId,
  )
  return database.$transaction(async (transaction) => {
    const existing = await transaction.retentionPolicy.findUnique({
      where: {
        organizationId_category: {
          organizationId: data.organizationId,
          category: data.category,
        },
      },
    })
    const policy = await transaction.retentionPolicy.upsert({
      where: {
        organizationId_category: {
          organizationId: data.organizationId,
          category: data.category,
        },
      },
      create: { ...data, updatedById: actorUserId },
      update: { retentionDays: data.retentionDays, updatedById: actorUserId },
    })
    await recordAuditEvent(transaction, {
      organizationId: data.organizationId,
      actorUserId,
      action: existing ? 'retentionPolicy.updated' : 'retentionPolicy.created',
      resourceType: 'retentionPolicy',
      resourceId: policy.id,
      metadata: {
        category: data.category,
        retentionDays: data.retentionDays,
      },
    })
    return policy
  })
}

export async function listRetentionPolicies(
  database: PrismaClient,
  actorUserId: string,
  organizationId: string,
) {
  z.uuid().parse(organizationId)
  await requireRetentionAdministrator(database, actorUserId, organizationId)
  return database.retentionPolicy.findMany({
    where: { organizationId },
    orderBy: [{ category: 'asc' }, { id: 'asc' }],
  })
}

async function eligibleRecords(
  database: PrismaClient,
  organizationId: string,
  category: RetentionCategory,
  cutoff: Date,
) {
  if (category === 'messages') {
    const result = await database.familyMessage.aggregate({
      where: {
        conversation: { school: { organizationId } },
        createdAt: { lt: cutoff },
      },
      _count: true,
      _min: { createdAt: true },
    })
    return { count: result._count, oldest: result._min.createdAt }
  }
  if (category === 'auditEvents') {
    const schoolIds = (
      await database.school.findMany({
        where: { organizationId },
        select: { id: true },
      })
    ).map((school) => school.id)
    const result = await database.auditEvent.aggregate({
      where: {
        OR: [
          { organizationId },
          ...(schoolIds.length ? [{ schoolId: { in: schoolIds } }] : []),
        ],
        occurredAt: { lt: cutoff },
      },
      _count: true,
      _min: { occurredAt: true },
    })
    return { count: result._count, oldest: result._min.occurredAt }
  }
  if (category === 'issuedDocuments') {
    const result = await database.issuedDocument.aggregate({
      where: { school: { organizationId }, createdAt: { lt: cutoff } },
      _count: true,
      _min: { createdAt: true },
    })
    return { count: result._count, oldest: result._min.createdAt }
  }
  if (category === 'academicRecords') {
    const result = await database.publishedResult.aggregate({
      where: { school: { organizationId }, createdAt: { lt: cutoff } },
      _count: true,
      _min: { createdAt: true },
    })
    return { count: result._count, oldest: result._min.createdAt }
  }
  const result = await database.enrollment.aggregate({
    where: { school: { organizationId }, createdAt: { lt: cutoff } },
    _count: true,
    _min: { createdAt: true },
  })
  return { count: result._count, oldest: result._min.createdAt }
}

export async function evaluateRetention(
  database: PrismaClient,
  actorUserId: string,
  organizationId: string,
  category: unknown,
  evaluatedAt = new Date(),
) {
  z.uuid().parse(organizationId)
  const checkedCategory = RetentionCategorySchema.parse(category)
  await requireRetentionAdministrator(database, actorUserId, organizationId)
  const policy = await database.retentionPolicy.findUnique({
    where: {
      organizationId_category: {
        organizationId,
        category: checkedCategory,
      },
    },
  })
  if (!policy) throw new RetentionPolicyNotFoundError()
  const cutoff = new Date(
    evaluatedAt.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000,
  )
  const eligible = await eligibleRecords(
    database,
    organizationId,
    checkedCategory,
    cutoff,
  )
  return {
    category: checkedCategory,
    retentionDays: policy.retentionDays,
    evaluatedAt,
    cutoff,
    eligibleCount: eligible.count,
    oldestEligibleAt: eligible.oldest,
  }
}

export type { RetentionPolicy } from '@prisma/client'
