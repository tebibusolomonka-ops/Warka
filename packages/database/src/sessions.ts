import type { PrismaClient, Session } from '@prisma/client'

export type CreateSessionRecord = {
  userId: string
  tokenHash: string
  expiresAt: Date
}

export function createSessionRecord(
  database: PrismaClient,
  data: CreateSessionRecord,
): Promise<Session> {
  return database.session.create({ data })
}

export function findSessionByHash(database: PrismaClient, tokenHash: string) {
  return database.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  })
}

export async function revokeSessionByHash(
  database: PrismaClient,
  tokenHash: string,
): Promise<void> {
  await database.session.deleteMany({ where: { tokenHash } })
}

export async function revokeSessionsForUser(
  database: PrismaClient,
  userId: string,
): Promise<void> {
  await database.session.deleteMany({ where: { userId } })
}
