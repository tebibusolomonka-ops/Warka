import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'
import { effectiveMembershipWhere } from './membershipPeriods.js'
import { RetentionPermissionError } from './retentionPolicies.js'

const holdInput = z.strictObject({
  organizationId: z.uuid(),
  scope: z.enum(['student', 'privacyRequest', 'issuedDocument']),
  recordId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
})
async function requireAdmin(
  database: Pick<PrismaClient, 'user' | 'organizationMembership'>,
  actorUserId: string,
  organizationId: string,
) {
  const [user, membership] = await Promise.all([
    database.user.findUnique({
      where: { id: actorUserId },
      select: { accountStatus: true },
    }),
    database.organizationMembership.findUnique({
      where: {
        userId_organizationId: { userId: actorUserId, organizationId },
        ...effectiveMembershipWhere(),
      },
      select: { role: true },
    }),
  ])
  if (
    user?.accountStatus !== 'active' ||
    !membership ||
    !['owner', 'administrator'].includes(membership.role)
  )
    throw new RetentionPermissionError()
}

export async function createRetentionHold(
  database: PrismaClient,
  actorUserId: string,
  input: unknown,
) {
  z.uuid().parse(actorUserId)
  const data = holdInput.parse(input)
  return database.$transaction(
    async (transaction) => {
      await requireAdmin(transaction, actorUserId, data.organizationId)
      let valid = false
      if (data.scope === 'student')
        valid = !!(await transaction.student.findFirst({
          where: {
            id: data.recordId,
            enrollments: {
              some: { school: { organizationId: data.organizationId } },
            },
          },
          select: { id: true },
        }))
      if (data.scope === 'privacyRequest')
        valid = !!(await transaction.privacyRequest.findFirst({
          where: {
            id: data.recordId,
            school: { organizationId: data.organizationId },
          },
          select: { id: true },
        }))
      if (data.scope === 'issuedDocument')
        valid = !!(await transaction.issuedDocument.findFirst({
          where: {
            id: data.recordId,
            school: { organizationId: data.organizationId },
          },
          select: { id: true },
        }))
      if (!valid) throw new RetentionPermissionError()
      const existing = await transaction.retentionHold.findFirst({
        where: {
          organizationId: data.organizationId,
          scope: data.scope,
          releasedAt: null,
          ...(data.scope === 'student'
            ? { studentId: data.recordId }
            : data.scope === 'privacyRequest'
              ? { privacyRequestId: data.recordId }
              : { issuedDocumentId: data.recordId }),
        },
      })
      if (existing) return existing
      const hold = await transaction.retentionHold.create({
        data: {
          organizationId: data.organizationId,
          scope: data.scope,
          reason: data.reason,
          createdById: actorUserId,
          ...(data.scope === 'student'
            ? { studentId: data.recordId }
            : data.scope === 'privacyRequest'
              ? { privacyRequestId: data.recordId }
              : { issuedDocumentId: data.recordId }),
        },
      })
      await recordAuditEvent(transaction, {
        organizationId: data.organizationId,
        actorUserId,
        action: 'retentionHold.created',
        resourceType: 'retentionHold',
        resourceId: hold.id,
        metadata: { scope: data.scope },
      })
      return hold
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function releaseRetentionHold(
  database: PrismaClient,
  actorUserId: string,
  holdId: string,
  now = new Date(),
) {
  z.uuid().parse(actorUserId)
  z.uuid().parse(holdId)
  return database.$transaction(
    async (transaction) => {
      const hold = await transaction.retentionHold.findUnique({
        where: { id: holdId },
      })
      if (!hold) throw new RetentionPermissionError()
      await requireAdmin(transaction, actorUserId, hold.organizationId)
      if (hold.releasedAt) return hold
      const released = await transaction.retentionHold.update({
        where: { id: holdId },
        data: { releasedAt: now, releasedById: actorUserId },
      })
      await recordAuditEvent(transaction, {
        organizationId: hold.organizationId,
        actorUserId,
        action: 'retentionHold.released',
        resourceType: 'retentionHold',
        resourceId: holdId,
        metadata: { scope: hold.scope },
      })
      return released
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function listRetentionHolds(
  database: PrismaClient,
  actorUserId: string,
  organizationId: string,
  take = 25,
  skip = 0,
) {
  z.uuid().parse(actorUserId)
  z.uuid().parse(organizationId)
  await requireAdmin(database, actorUserId, organizationId)
  const pageSize = z.number().int().min(1).max(50).parse(take)
  const offset = z.number().int().min(0).max(100000).parse(skip)
  const where = { organizationId }
  return {
    total: await database.retentionHold.count({ where }),
    items: await database.retentionHold.findMany({
      where,
      take: pageSize,
      skip: offset,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        scope: true,
        studentId: true,
        privacyRequestId: true,
        issuedDocumentId: true,
        reason: true,
        createdAt: true,
        releasedAt: true,
      },
    }),
    take: pageSize,
    skip: offset,
  }
}
