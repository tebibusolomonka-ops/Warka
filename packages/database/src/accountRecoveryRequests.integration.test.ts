import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  cancelRecoveryRequest,
  completeRecoveryRequest,
  createRecoveryRequest,
  expireRecoveryRequests,
  findActiveRecoveryRequest,
} from './accountRecoveryRequests.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null
afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('account recovery requests in PostgreSQL', () => {
  it('limits active requests and supports expiry, cancellation, and completion', async () => {
    const user = await database!.user.create({
      data: {
        email: `recovery-${randomUUID()}@example.test`,
        displayName: 'Recovery User',
      },
    })
    const now = new Date('2026-09-26T10:00:00.000Z')
    try {
      const first = await createRecoveryRequest(database!, user.id, now)
      expect((await createRecoveryRequest(database!, user.id, now)).id).toBe(
        first.id,
      )
      expect(
        (await findActiveRecoveryRequest(database!, user.id, now))?.id,
      ).toBe(first.id)
      expect(
        (
          await completeRecoveryRequest(
            database!,
            first.id,
            new Date(now.getTime() + 1000),
          )
        ).count,
      ).toBe(1)
      expect(
        (await completeRecoveryRequest(database!, first.id, now)).count,
      ).toBe(0)
      const second = await createRecoveryRequest(database!, user.id, now)
      expect(second.id).not.toBe(first.id)
      expect(
        (await cancelRecoveryRequest(database!, second.id, now)).count,
      ).toBe(1)
      const third = await createRecoveryRequest(database!, user.id, now)
      expect(third.id).not.toBe(second.id)
      await expireRecoveryRequests(
        database!,
        user.id,
        new Date(now.getTime() + 31 * 60 * 1000),
      )
      expect(
        await findActiveRecoveryRequest(
          database!,
          user.id,
          new Date(now.getTime() + 31 * 60 * 1000),
        ),
      ).toBeNull()
      expect(
        (
          await createRecoveryRequest(
            database!,
            user.id,
            new Date(now.getTime() + 31 * 60 * 1000),
          )
        ).id,
      ).not.toBe(third.id)
    } finally {
      await database!.user.delete({ where: { id: user.id } })
    }
  })
})
