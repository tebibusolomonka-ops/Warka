import { createHash } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

const windowMs = 5 * 60_000
const threshold = 8

export function loginEmailHash(email: string) {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

export async function isLoginThrottled(
  database: PrismaClient,
  email: string,
  now = new Date(),
) {
  const bucket = await database.loginAttemptBucket.findUnique({
    where: { emailHash: loginEmailHash(email) },
  })
  return !!bucket?.blockedUntil && bucket.blockedUntil > now
}

export async function recordFailedLogin(
  database: PrismaClient,
  email: string,
  now = new Date(),
) {
  const emailHash = loginEmailHash(email)
  const current = await database.loginAttemptBucket.findUnique({
    where: { emailHash },
  })
  if (
    !current ||
    current.windowStartsAt.getTime() + windowMs <= now.getTime()
  ) {
    await database.loginAttemptBucket.upsert({
      where: { emailHash },
      create: { emailHash, failures: 1, windowStartsAt: now },
      update: { failures: 1, windowStartsAt: now, blockedUntil: null },
    })
    return
  }
  await database.loginAttemptBucket.update({
    where: { emailHash },
    data: {
      failures: { increment: 1 },
      ...(current.failures + 1 >= threshold
        ? { blockedUntil: new Date(now.getTime() + windowMs) }
        : {}),
    },
  })
}

export async function clearFailedLogins(database: PrismaClient, email: string) {
  await database.loginAttemptBucket.deleteMany({
    where: { emailHash: loginEmailHash(email) },
  })
}
