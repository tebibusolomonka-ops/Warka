import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  createRecoveryRequest,
  cancelRecoveryRequest,
} from './accountRecoveryRequests.js'
import {
  createRecoveryToken,
  resolveRecoveryToken,
  consumeRecoveryToken,
  deriveRecoveryToken,
  issueDerivedRecoveryToken,
} from './recoveryTokens.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('recovery tokens in PostgreSQL', () => {
  it('stores only a hash of the derived recovery email token', async () => {
    const user = await database!.user.create({
      data: {
        email: `derived-token-${randomUUID()}@example.test`,
        displayName: 'Recovery Recipient',
      },
    })
    const key = Buffer.alloc(32, 5).toString('base64url')
    try {
      const request = await createRecoveryRequest(database!, user.id)
      const token = await issueDerivedRecoveryToken(database!, request.id, key)
      expect(token).toBe(deriveRecoveryToken(request.id, key))
      const stored = await database!.accountRecoveryRequest.findUniqueOrThrow({
        where: { id: request.id },
      })
      expect(stored.tokenHash).not.toBe(token)
      expect(await resolveRecoveryToken(database!, token!)).toMatchObject({
        id: request.id,
      })
      expect(await consumeRecoveryToken(database!, token!)).toBe(true)
      expect(await consumeRecoveryToken(database!, token!)).toBe(false)
    } finally {
      await database!.user.delete({ where: { id: user.id } })
    }
  })

  it('stores only hashes and accepts a live token once', async () => {
    const user = await database!.user.create({
      data: {
        email: `token-${randomUUID()}@example.test`,
        displayName: 'Token User',
      },
    })
    const now = new Date()
    try {
      const request = await createRecoveryRequest(database!, user.id, now)
      const first = await createRecoveryToken(database!, request.id, now)
      expect(first).toBeTruthy()
      expect(
        (
          await database!.accountRecoveryRequest.findUniqueOrThrow({
            where: { id: request.id },
          })
        ).tokenHash,
      ).not.toBe(first)
      expect(await resolveRecoveryToken(database!, first!, now)).toMatchObject({
        id: request.id,
      })
      expect(await resolveRecoveryToken(database!, 'invalid', now)).toBeNull()
      const second = await createRecoveryToken(database!, request.id, now)
      expect(second).not.toBe(first)
      expect(await resolveRecoveryToken(database!, first!, now)).toBeNull()
      expect(await consumeRecoveryToken(database!, second!, now)).toBe(true)
      expect(await consumeRecoveryToken(database!, second!, now)).toBe(false)
      expect(await resolveRecoveryToken(database!, second!, now)).toBeNull()
      const expired = await createRecoveryRequest(
        database!,
        user.id,
        new Date(now.getTime() + 1000),
      )
      const expiredToken = await createRecoveryToken(database!, expired.id, now)
      expect(
        await resolveRecoveryToken(
          database!,
          expiredToken!,
          new Date(now.getTime() + 31 * 60 * 1000),
        ),
      ).toBeNull()
      const cancelled = await createRecoveryRequest(
        database!,
        user.id,
        new Date(now.getTime() + 31 * 60 * 1000),
      )
      const cancelledToken = await createRecoveryToken(
        database!,
        cancelled.id,
        new Date(now.getTime() + 31 * 60 * 1000),
      )
      await cancelRecoveryRequest(database!, cancelled.id)
      expect(await resolveRecoveryToken(database!, cancelledToken!)).toBeNull()
    } finally {
      await database!.user.delete({ where: { id: user.id } })
    }
  })
})
