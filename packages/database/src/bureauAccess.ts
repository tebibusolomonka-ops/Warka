import { Prisma, type BureauRole, type PrismaClient } from '@prisma/client'

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

type BureauStore = Pick<PrismaClient, 'bureauAccess'>

export async function grantBureauAccess(
  database: BureauStore,
  input: { userId: string; organizationId: string; role: BureauRole },
) {
  try {
    return await database.bureauAccess.create({ data: input })
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
) {
  return database.bureauAccess.update({
    where: { userId_organizationId: { userId, organizationId } },
    data: { revokedAt: new Date() },
  })
}

export function resolveBureauScope(database: BureauStore, userId: string) {
  return database.bureauAccess.findMany({
    where: { userId, revokedAt: null },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  })
}

export async function requireBureauPermission(
  database: BureauStore,
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
