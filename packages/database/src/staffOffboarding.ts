import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'
import { effectiveMembershipWhere } from './membershipPeriods.js'

export class StaffOffboardingPermissionError extends Error {
  constructor() {
    super('Staff offboarding permission denied')
  }
}

export async function offboardStaff(
  database: PrismaClient,
  input: {
    actorUserId: string
    targetUserId: string
    schoolId: string
    reason: string
    endOrganizationMembership?: boolean
  },
  now = new Date(),
) {
  const actorUserId = z.uuid().parse(input.actorUserId)
  const targetUserId = z.uuid().parse(input.targetUserId)
  const schoolId = z.uuid().parse(input.schoolId)
  const reason = z.string().trim().min(3).max(500).parse(input.reason)
  if (actorUserId === targetUserId) throw new StaffOffboardingPermissionError()
  return database.$transaction(
    async (transaction) => {
      const school = await transaction.school.findUnique({
        where: { id: schoolId },
      })
      const actor = await transaction.user.findUnique({
        where: { id: actorUserId },
      })
      if (!school || actor?.accountStatus !== 'active')
        throw new StaffOffboardingPermissionError()
      const [
        organizationAdmin,
        schoolAdmin,
        targetMembership,
        targetOrganizationMembership,
      ] = await Promise.all([
        transaction.organizationMembership.findUnique({
          where: {
            userId_organizationId: {
              userId: actorUserId,
              organizationId: school.organizationId,
            },
            ...effectiveMembershipWhere(now),
          },
        }),
        transaction.schoolMembership.findUnique({
          where: {
            userId_schoolId: { userId: actorUserId, schoolId },
            ...effectiveMembershipWhere(now),
          },
        }),
        transaction.schoolMembership.findUnique({
          where: {
            userId_schoolId: { userId: targetUserId, schoolId },
            ...effectiveMembershipWhere(now),
          },
        }),
        transaction.organizationMembership.findUnique({
          where: {
            userId_organizationId: {
              userId: targetUserId,
              organizationId: school.organizationId,
            },
            ...effectiveMembershipWhere(now),
          },
        }),
      ])
      const mayManageOrganization =
        organizationAdmin?.role === 'owner' ||
        organizationAdmin?.role === 'administrator'
      if (
        (!mayManageOrganization && schoolAdmin?.role !== 'administrator') ||
        !targetMembership ||
        (input.endOrganizationMembership && !mayManageOrganization) ||
        (targetOrganizationMembership && !input.endOrganizationMembership)
      )
        throw new StaffOffboardingPermissionError()
      const schoolResult = await transaction.schoolMembership.updateMany({
        where: {
          userId: targetUserId,
          schoolId,
          ...effectiveMembershipWhere(now),
        },
        data: { endsAt: now },
      })
      const assignments = await transaction.teachingAssignment.updateMany({
        where: {
          userId: targetUserId,
          schoolId,
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
        data: { endsAt: now },
      })
      let organizationEnded = false
      if (input.endOrganizationMembership) {
        const result = await transaction.organizationMembership.updateMany({
          where: {
            userId: targetUserId,
            organizationId: school.organizationId,
            ...effectiveMembershipWhere(now),
          },
          data: { endsAt: now },
        })
        organizationEnded = result.count > 0
      }
      await transaction.session.deleteMany({ where: { userId: targetUserId } })
      await recordAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action: 'schoolStaff.offboarded',
        resourceType: 'user',
        resourceId: targetUserId,
        metadata: {
          reason,
          organizationEnded,
          assignmentsEnded: assignments.count,
        },
      })
      return {
        schoolMembershipEnded: schoolResult.count === 1,
        organizationMembershipEnded: organizationEnded,
        assignmentsEnded: assignments.count,
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
