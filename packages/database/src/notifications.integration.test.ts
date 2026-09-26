import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import {
  createDatabaseClient,
  createNotification,
  createNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
} from './index.js'

const testUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = testUrl
  ? createDatabaseClient({ DATABASE_URL: testUrl })
  : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('notifications in PostgreSQL', () => {
  it('stores bounded plain text and keeps read operations on the owner', async () => {
    const suffix = randomUUID()
    const first = await database!.user.create({
      data: {
        email: `notification-first-${suffix}@example.test`,
        displayName: 'First',
      },
    })
    const second = await database!.user.create({
      data: {
        email: `notification-second-${suffix}@example.test`,
        displayName: 'Second',
      },
    })
    try {
      const created = await createNotification(database!, {
        userId: first.id,
        type: 'result.published',
        title: 'Results available',
        message: 'Your results are available.',
        resourceType: 'resultSet',
        resourceId: randomUUID(),
      })
      expect(created.resourceType).toBe('resultSet')
      expect(await listNotifications(database!, second.id)).toEqual([])
      expect(await unreadNotificationCount(database!, first.id)).toBe(1)
      expect(await markNotificationRead(database!, second.id, created.id)).toBe(
        false,
      )
      expect(await unreadNotificationCount(database!, first.id)).toBe(1)
      expect(await markNotificationRead(database!, first.id, created.id)).toBe(
        true,
      )
      expect(await unreadNotificationCount(database!, first.id)).toBe(0)
      expect(
        (await listNotifications(database!, first.id))[0]?.readAt,
      ).not.toBeNull()
      await createNotifications(database!, [first.id, first.id, second.id], {
        type: 'announcement.created',
        title: 'School notice',
        message: 'A notice is available.',
      })
      expect(await unreadNotificationCount(database!, first.id)).toBe(1)
      expect(await unreadNotificationCount(database!, second.id)).toBe(1)
      expect((await markAllNotificationsRead(database!, first.id)).count).toBe(
        1,
      )
      expect(await unreadNotificationCount(database!, first.id)).toBe(0)
      expect(await unreadNotificationCount(database!, second.id)).toBe(1)
      expect(() =>
        createNotification(database!, {
          userId: first.id,
          type: 'test.event',
          title: '<b>Unsafe</b>',
          message: 'Message',
        }),
      ).toThrow()
      expect(() =>
        createNotification(database!, {
          userId: first.id,
          type: 'test.event',
          title: 'Title',
          message: 'x'.repeat(301),
        }),
      ).toThrow()
    } finally {
      await database!.notification.deleteMany({
        where: { userId: { in: [first.id, second.id] } },
      })
      await database!.user.deleteMany({
        where: { id: { in: [first.id, second.id] } },
      })
    }
  })
})
