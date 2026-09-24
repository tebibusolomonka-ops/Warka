import { createHash, randomBytes } from 'node:crypto'
import {
  createSessionRecord,
  findSessionByHash,
  revokeSessionByHash,
  revokeSessionsForUser,
  type PrismaClient,
  type User,
} from '@warka/database'

export const SESSION_LIFETIME_SECONDS = 7 * 24 * 60 * 60

const tokenPattern = /^[A-Za-z0-9_-]{43}$/

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(
  database: PrismaClient,
  userId: string,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_SECONDS * 1000)
  await createSessionRecord(database, {
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  })
  return { token, expiresAt }
}

export async function resolveSession(
  database: PrismaClient,
  token: string,
  now: Date = new Date(),
): Promise<User | null> {
  if (!tokenPattern.test(token)) return null
  const session = await findSessionByHash(database, hashSessionToken(token))
  if (!session || session.expiresAt.getTime() <= now.getTime()) {
    return null
  }
  return session.user
}

export async function revokeSession(
  database: PrismaClient,
  token: string,
): Promise<void> {
  if (!tokenPattern.test(token)) return
  await revokeSessionByHash(database, hashSessionToken(token))
}

export function revokeAllSessionsForUser(
  database: PrismaClient,
  userId: string,
): Promise<void> {
  return revokeSessionsForUser(database, userId)
}
