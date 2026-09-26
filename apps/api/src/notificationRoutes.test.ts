import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerNotificationRoutes } from './notificationRoutes.js'

const mocks = vi.hoisted(() => ({
  listNotifications: vi.fn(),
  unreadNotificationCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))
vi.mock('@warka/database', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@warka/database')>()),
  ...mocks,
}))
const userId = '08b6fcb4-07b6-4fbe-8ad7-0f6001db315c'
const notificationId = '9d113102-69c3-436b-ab9b-45f65f47ed4a'
function testApp(authenticated = true) {
  const app = Fastify()
  registerNotificationRoutes(
    app,
    () => ({}) as PrismaClient,
    async (request, reply) => {
      if (!authenticated) {
        await reply.code(401).send({ error: 'Unauthenticated' })
        return
      }
      request.currentUser = { id: userId } as User
    },
  )
  return app
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.listNotifications.mockResolvedValue([{ id: notificationId }])
  mocks.unreadNotificationCount.mockResolvedValue(1)
  mocks.markNotificationRead.mockResolvedValue(true)
  mocks.markAllNotificationsRead.mockResolvedValue({ count: 1 })
})
describe('notification routes', () => {
  it('requires authentication and always uses the session user', async () => {
    const anonymous = testApp(false)
    expect(
      (await anonymous.inject({ method: 'GET', url: '/notifications' }))
        .statusCode,
    ).toBe(401)
    await anonymous.close()
    const app = testApp()
    const list = await app.inject({
      method: 'GET',
      url: '/notifications?unread=true&take=1',
    })
    expect(list.statusCode).toBe(200)
    expect(mocks.listNotifications).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      { unread: true, take: 2 },
    )
    expect(
      (
        await app.inject({ method: 'GET', url: '/notifications/unread-count' })
      ).json(),
    ).toEqual({ count: 1 })
    expect(mocks.unreadNotificationCount).toHaveBeenCalledWith(
      expect.anything(),
      userId,
    )
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/notifications/${notificationId}/read`,
        })
      ).statusCode,
    ).toBe(200)
    expect(mocks.markNotificationRead).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      notificationId,
    )
    expect(
      (
        await app.inject({ method: 'POST', url: '/notifications/read-all' })
      ).json(),
    ).toEqual({ count: 1 })
    expect(mocks.markAllNotificationsRead).toHaveBeenCalledWith(
      expect.anything(),
      userId,
    )
    await app.close()
  })
  it('does not disclose another user notification and bounds pagination', async () => {
    const app = testApp()
    mocks.markNotificationRead.mockResolvedValue(false)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/notifications/${notificationId}/read`,
        })
      ).statusCode,
    ).toBe(404)
    expect(
      (await app.inject({ method: 'GET', url: '/notifications?take=1000' }))
        .statusCode,
    ).toBe(500)
    await app.close()
  })
})
