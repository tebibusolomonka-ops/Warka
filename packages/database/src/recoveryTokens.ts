import { createHash, createHmac, randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'

export function hashRecoveryToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function deriveRecoveryToken(requestId: string, secret: string) {
  const bytes = Buffer.from(secret, 'base64url')
  if (bytes.length !== 32) throw new Error('Invalid recovery token key')
  return createHmac('sha256', bytes)
    .update(`warka-recovery-v1:${z.uuid().parse(requestId)}`)
    .digest('base64url')
}

export async function issueDerivedRecoveryToken(
  database: PrismaClient,
  requestId: string,
  secret: string,
  now = new Date(),
) {
  const token = deriveRecoveryToken(requestId, secret)
  const changed = await database.accountRecoveryRequest.updateMany({
    where: { id: requestId, status: 'pending', expiresAt: { gt: now } },
    data: { tokenHash: hashRecoveryToken(token) },
  })
  return changed.count === 1 ? token : null
}

export async function createRecoveryToken(
  database: PrismaClient,
  requestId: string,
  now = new Date(),
) {
  const token = randomBytes(32).toString('base64url')
  const changed = await database.accountRecoveryRequest.updateMany({
    where: {
      id: z.uuid().parse(requestId),
      status: 'pending',
      expiresAt: { gt: now },
    },
    data: { tokenHash: hashRecoveryToken(token) },
  })
  if (changed.count !== 1) return null
  return token
}

export async function resolveRecoveryToken(
  database: PrismaClient,
  token: string,
  now = new Date(),
) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return null
  return database.accountRecoveryRequest.findFirst({
    where: {
      tokenHash: hashRecoveryToken(token),
      status: 'pending',
      expiresAt: { gt: now },
    },
  })
}

export async function consumeRecoveryToken(
  database: PrismaClient,
  token: string,
  now = new Date(),
) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return false
  const changed = await database.accountRecoveryRequest.updateMany({
    where: {
      tokenHash: hashRecoveryToken(token),
      status: 'pending',
      expiresAt: { gt: now },
    },
    data: { status: 'completed', completedAt: now, tokenHash: null },
  })
  return changed.count === 1
}
