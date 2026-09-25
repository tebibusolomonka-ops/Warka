import { Prisma, type GuardianAccess, type PrismaClient } from '@prisma/client'

export class DuplicateGuardianAccessError extends Error {
  constructor() {
    super('User or guardian already has an access link')
  }
}

type GuardianAccessStore = Pick<PrismaClient, 'guardianAccess'>

export async function linkGuardianUser(
  database: GuardianAccessStore,
  userId: string,
  guardianId: string,
): Promise<GuardianAccess> {
  try {
    return await database.guardianAccess.create({
      data: { userId, guardianId },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new DuplicateGuardianAccessError()
    }
    throw error
  }
}

export function findGuardianAccessForUser(
  database: GuardianAccessStore,
  userId: string,
) {
  return database.guardianAccess.findUnique({
    where: { userId },
    include: { guardian: true },
  })
}

export function findLinkedUserForGuardian(
  database: GuardianAccessStore,
  guardianId: string,
) {
  return database.guardianAccess.findUnique({
    where: { guardianId },
    include: { user: true },
  })
}

export async function removeGuardianAccess(
  database: GuardianAccessStore,
  guardianId: string,
): Promise<void> {
  await database.guardianAccess.deleteMany({ where: { guardianId } })
}
