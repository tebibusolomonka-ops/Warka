import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  getNotificationPreferences,
  setNotificationPreference,
} from './notificationPreferences.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('notification preferences in PostgreSQL', () => {
  it('persists user-scoped choices and enforces security at the database boundary', async () => {
    const user = await database!.user.create({
      data: {
        email: `preference-${randomUUID()}@example.test`,
        displayName: 'Preference User',
      },
    })
    try {
      await setNotificationPreference(database!, user.id, 'support', {
        inAppEnabled: true,
        emailEnabled: true,
      })
      expect(
        (await getNotificationPreferences(database!, user.id)).find(
          (item) => item.category === 'support',
        )?.emailEnabled,
      ).toBe(true)
      await expect(
        database!.notificationPreference.create({
          data: {
            userId: user.id,
            category: 'accountSecurity',
            inAppEnabled: false,
          },
        }),
      ).rejects.toThrow()
    } finally {
      await database!.user.delete({ where: { id: user.id } })
    }
  })
})
