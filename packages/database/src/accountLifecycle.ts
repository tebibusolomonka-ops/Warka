import { Prisma, type AccountStatus, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'

export const AccountStatusSchema = z.enum([
  'active',
  'suspended',
  'deactivated',
])

export class AccountLifecyclePermissionError extends Error {
  constructor() {
    super('Account lifecycle permission denied')
  }
}

export async function changeAccountStatus(
  database: PrismaClient,
  input: {
    actorUserId: string
    targetUserId: string
    schoolId: string
    status: AccountStatus
    reason: string
  },
) {
  const actorUserId = z.uuid().parse(input.actorUserId)
  const targetUserId = z.uuid().parse(input.targetUserId)
  const schoolId = z.uuid().parse(input.schoolId)
  const status = AccountStatusSchema.parse(input.status)
  const reason = z.string().trim().min(3).max(500).parse(input.reason)
  if (actorUserId === targetUserId) throw new AccountLifecyclePermissionError()
  return database.$transaction(
    async (transaction) => {
      const [school, actor, target] = await Promise.all([
        transaction.school.findUnique({ where: { id: schoolId } }),
        transaction.user.findUnique({ where: { id: actorUserId } }),
        transaction.user.findUnique({
          where: { id: targetUserId },
          include: { schoolMemberships: true },
        }),
      ])
      if (!school || !actor || actor.accountStatus !== 'active' || !target)
        throw new AccountLifecyclePermissionError()
      const [organizationMembership, schoolMembership] = await Promise.all([
        transaction.organizationMembership.findUnique({
          where: {
            userId_organizationId: {
              userId: actorUserId,
              organizationId: school.organizationId,
            },
          },
        }),
        transaction.schoolMembership.findUnique({
          where: { userId_schoolId: { userId: actorUserId, schoolId } },
        }),
      ])
      if (
        !['owner', 'administrator'].includes(
          organizationMembership?.role ?? '',
        ) &&
        schoolMembership?.role !== 'administrator'
      )
        throw new AccountLifecyclePermissionError()
      if (!target.schoolMemberships.some((item) => item.schoolId === schoolId))
        throw new AccountLifecyclePermissionError()
      if (target.accountStatus === status) return target
      const updated = await transaction.user.update({
        where: { id: targetUserId },
        data: { accountStatus: status },
      })
      if (status !== 'active')
        await transaction.session.deleteMany({
          where: { userId: targetUserId },
        })
      await recordAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action: 'account.lifecycleChanged',
        resourceType: 'user',
        resourceId: targetUserId,
        metadata: {
          previousStatus: target.accountStatus,
          status,
          reason,
        },
      })
      return updated
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
