import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'

const id = z.uuid()
const lifetimeMs = 30 * 60 * 1000

export async function expireRecoveryRequests(
  database: PrismaClient,
  userId: string,
  now = new Date(),
) {
  return database.accountRecoveryRequest.updateMany({
    where: {
      userId: id.parse(userId),
      status: 'pending',
      expiresAt: { lte: now },
    },
    data: { status: 'expired' },
  })
}

export async function findActiveRecoveryRequest(
  database: PrismaClient,
  userId: string,
  now = new Date(),
) {
  await expireRecoveryRequests(database, userId, now)
  return database.accountRecoveryRequest.findFirst({
    where: {
      userId: id.parse(userId),
      status: 'pending',
      expiresAt: { gt: now },
    },
  })
}

export async function createRecoveryRequest(
  database: PrismaClient,
  userId: string,
  now = new Date(),
) {
  const parsedUserId = id.parse(userId)
  return database.$transaction(
    async (transaction) => {
      await transaction.accountRecoveryRequest.updateMany({
        where: {
          userId: parsedUserId,
          status: 'pending',
          expiresAt: { lte: now },
        },
        data: { status: 'expired' },
      })
      const existing = await transaction.accountRecoveryRequest.findFirst({
        where: {
          userId: parsedUserId,
          status: 'pending',
          expiresAt: { gt: now },
        },
      })
      if (existing) return existing
      return transaction.accountRecoveryRequest.create({
        data: {
          userId: parsedUserId,
          expiresAt: new Date(now.getTime() + lifetimeMs),
        },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function cancelRecoveryRequest(
  database: PrismaClient,
  requestId: string,
  now = new Date(),
) {
  return database.accountRecoveryRequest.updateMany({
    where: { id: id.parse(requestId), status: 'pending' },
    data: { status: 'cancelled', cancelledAt: now },
  })
}

export async function completeRecoveryRequest(
  database: PrismaClient,
  requestId: string,
  now = new Date(),
) {
  return database.accountRecoveryRequest.updateMany({
    where: {
      id: id.parse(requestId),
      status: 'pending',
      expiresAt: { gt: now },
    },
    data: { status: 'completed', completedAt: now },
  })
}
