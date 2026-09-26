import {
  hashRecoveryToken,
  recordAuditEvent,
  type PrismaClient,
} from '@warka/database'
import { hashPassword } from './passwords.js'

export class InvalidRecoveryTokenError extends Error {
  constructor() {
    super('Invalid or expired recovery token')
  }
}

export async function resetPasswordWithRecoveryToken(
  database: PrismaClient,
  token: string,
  newPassword: string,
  now = new Date(),
) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token))
    throw new InvalidRecoveryTokenError()
  const passwordHash = await hashPassword(newPassword)
  await database.$transaction(async (transaction) => {
    const request = await transaction.accountRecoveryRequest.findFirst({
      where: {
        tokenHash: hashRecoveryToken(token),
        status: 'pending',
        expiresAt: { gt: now },
      },
      select: { id: true, userId: true },
    })
    if (!request) throw new InvalidRecoveryTokenError()
    const consumed = await transaction.accountRecoveryRequest.updateMany({
      where: {
        id: request.id,
        tokenHash: hashRecoveryToken(token),
        status: 'pending',
        expiresAt: { gt: now },
      },
      data: { status: 'completed', completedAt: now, tokenHash: null },
    })
    if (consumed.count !== 1) throw new InvalidRecoveryTokenError()
    await transaction.passwordCredential.upsert({
      where: { userId: request.userId },
      create: {
        userId: request.userId,
        passwordHash,
        mustChangePassword: false,
      },
      update: { passwordHash, mustChangePassword: false },
    })
    await transaction.session.deleteMany({ where: { userId: request.userId } })
    await recordAuditEvent(transaction, {
      actorUserId: request.userId,
      action: 'account.recovered',
      resourceType: 'user',
      resourceId: request.userId,
    })
  })
}
