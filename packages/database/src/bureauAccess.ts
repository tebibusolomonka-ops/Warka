import { Prisma, type BureauRole, type PrismaClient } from '@prisma/client'
import { recordAuditEvent } from './auditEvents.js'

export class DuplicateBureauAccessError extends Error {
  constructor() {
    super('User already has bureau access for this scope')
  }
}

export class BureauAccessDeniedError extends Error {
  constructor() {
    super('Bureau reporting access denied')
  }
}

type BureauPermissionStore = Pick<PrismaClient, 'bureauAccess'>
type BureauStore = Pick<
  PrismaClient,
  '$transaction' | 'auditEvent' | 'bureauAccess'
>

export async function grantBureauAccess(
  database: BureauStore,
  input: {
    userId: string
    organizationId: string
    role: BureauRole
    actorUserId?: string
  },
) {
  try {
    if (!input.actorUserId)
      return await database.bureauAccess.create({
        data: {
          userId: input.userId,
          organizationId: input.organizationId,
          role: input.role,
        },
      })
    return await database.$transaction(async (transaction) => {
      const access = await transaction.bureauAccess.create({
        data: {
          userId: input.userId,
          organizationId: input.organizationId,
          role: input.role,
        },
      })
      await recordAuditEvent(transaction, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: 'bureauAccess.granted',
        resourceType: 'bureauAccess',
        resourceId: access.id,
        metadata: { role: input.role, userId: input.userId },
      })
      return access
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new DuplicateBureauAccessError()
    throw error
  }
}

export async function revokeBureauAccess(
  database: BureauStore,
  userId: string,
  organizationId: string,
  actorUserId?: string,
) {
  if (!actorUserId)
    return database.bureauAccess.update({
      where: { userId_organizationId: { userId, organizationId } },
      data: { revokedAt: new Date() },
    })
  return database.$transaction(async (transaction) => {
    const access = await transaction.bureauAccess.update({
      where: { userId_organizationId: { userId, organizationId } },
      data: { revokedAt: new Date() },
    })
    await recordAuditEvent(transaction, {
      organizationId,
      actorUserId,
      action: 'bureauAccess.revoked',
      resourceType: 'bureauAccess',
      resourceId: access.id,
      metadata: { userId },
    })
    return access
  })
}

export function resolveBureauScope(
  database: BureauPermissionStore,
  userId: string,
) {
  return database.bureauAccess.findMany({
    where: { userId, revokedAt: null },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  })
}

export async function requireBureauPermission(
  database: BureauPermissionStore,
  userId: string,
  organizationId: string,
  permission: 'view' | 'manage',
) {
  const access = await database.bureauAccess.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  })
  if (
    !access ||
    access.revokedAt ||
    (permission === 'manage' && access.role !== 'reportManager')
  )
    throw new BureauAccessDeniedError()
  return access
}
