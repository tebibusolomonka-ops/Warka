import type { PrismaClient } from '@warka/database'
import { hashSessionToken } from './sessions.js'

export async function listOwnSessions(
  database: PrismaClient,
  userId: string,
  currentToken: string,
) {
  const currentHash = hashSessionToken(currentToken)
  const sessions = await database.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    select: {
      managementId: true,
      tokenHash: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return sessions.map(({ managementId, tokenHash, createdAt, expiresAt }) => ({
    managementId,
    createdAt,
    expiresAt,
    current: tokenHash === currentHash,
  }))
}

export async function revokeOwnSession(
  database: PrismaClient,
  userId: string,
  managementId: string,
) {
  const result = await database.session.deleteMany({
    where: { userId, managementId },
  })
  return result.count === 1
}

export async function revokeOtherSessions(
  database: PrismaClient,
  userId: string,
  currentToken: string,
) {
  return database.session.deleteMany({
    where: { userId, tokenHash: { not: hashSessionToken(currentToken) } },
  })
}
