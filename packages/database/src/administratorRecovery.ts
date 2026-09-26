import { randomBytes } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { hasOrganizationAdminRole } from './organizationMemberships.js'
import { hashRecoveryToken } from './recoveryTokens.js'
import { recordAuditEvent } from './auditEvents.js'

export class AdministratorRecoveryPermissionError extends Error {
  constructor() {
    super('Account recovery permission denied')
  }
}

export async function assistAccountRecovery(
  database: PrismaClient,
  actorUserId: string,
  schoolId: string,
  targetUserId: string,
  now = new Date(),
) {
  z.uuid().parse(actorUserId)
  z.uuid().parse(schoolId)
  z.uuid().parse(targetUserId)
  if (actorUserId === targetUserId)
    throw new AdministratorRecoveryPermissionError()
  const school = await database.school.findUnique({ where: { id: schoolId } })
  if (!school) throw new AdministratorRecoveryPermissionError()
  const [organizationAdmin, schoolAdmin] = await Promise.all([
    hasOrganizationAdminRole(database, actorUserId, school.organizationId),
    database.schoolMembership.findUnique({
      where: { userId_schoolId: { userId: actorUserId, schoolId } },
    }),
  ])
  if (!organizationAdmin && schoolAdmin?.role !== 'administrator')
    throw new AdministratorRecoveryPermissionError()
  const target = await database.user.findFirst({
    where: {
      id: targetUserId,
      OR: [
        { schoolMemberships: { some: { schoolId } } },
        {
          studentAccess: {
            is: { student: { enrollments: { some: { schoolId } } } },
          },
        },
        {
          guardianAccess: {
            is: {
              guardian: {
                students: {
                  some: {
                    verificationSchoolId: schoolId,
                    verificationStatus: 'verified',
                  },
                },
              },
            },
          },
        },
      ],
    },
    select: { id: true, email: true },
  })
  if (!target) throw new AdministratorRecoveryPermissionError()
  const token = randomBytes(32).toString('base64url')
  await database.$transaction(
    async (transaction) => {
      await transaction.accountRecoveryRequest.updateMany({
        where: { userId: targetUserId, status: 'pending' },
        data: { status: 'cancelled', cancelledAt: now },
      })
      await transaction.accountRecoveryRequest.create({
        data: {
          userId: targetUserId,
          tokenHash: hashRecoveryToken(token),
          expiresAt: new Date(now.getTime() + 30 * 60_000),
        },
      })
      await transaction.session.deleteMany({ where: { userId: targetUserId } })
      await transaction.passwordCredential.updateMany({
        where: { userId: targetUserId },
        data: { mustChangePassword: true },
      })
      await recordAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId,
        actorUserId,
        action: 'account.recoveryAssisted',
        resourceType: 'user',
        resourceId: targetUserId,
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
  return { email: target.email, token }
}
