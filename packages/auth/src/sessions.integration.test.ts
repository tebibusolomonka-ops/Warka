import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient, createUser } from '@warka/database'
import {
  createSession,
  hashSessionToken,
  resolveSession,
  revokeAllSessionsForUser,
  revokeSession,
} from './sessions.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('session persistence', () => {
  it('resolves, expires, and revokes sessions without storing raw tokens', async () => {
    const user = await createUser(database!, {
      email: `session-${randomUUID()}@example.test`,
      displayName: 'Session test',
    })
    const now = new Date('2026-09-24T10:00:00.000Z')

    try {
      const first = await createSession(database!, user.id, now)
      const second = await createSession(database!, user.id, now)
      const record = await database!.session.findUnique({
        where: { tokenHash: hashSessionToken(first.token) },
      })

      expect(record?.tokenHash).toBe(hashSessionToken(first.token))
      expect(record?.tokenHash).not.toBe(first.token)
      expect(await resolveSession(database!, first.token, now)).toEqual(user)
      expect(
        await resolveSession(database!, first.token, first.expiresAt),
      ).toBeNull()

      await revokeSession(database!, first.token)
      expect(await resolveSession(database!, first.token, now)).toBeNull()
      expect(await resolveSession(database!, second.token, now)).toEqual(user)

      await revokeAllSessionsForUser(database!, user.id)
      expect(await resolveSession(database!, second.token, now)).toBeNull()
    } finally {
      await database!.user.delete({ where: { id: user.id } })
    }
  })
})
