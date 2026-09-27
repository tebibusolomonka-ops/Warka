import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { ZodError } from 'zod'
import { describe, expect, it, vi } from 'vitest'
import { registerCommunicationPreferenceRoutes } from './communicationPreferenceRoutes.js'

const userId = '3e480e62-47d7-4525-9d88-b8891e56fac0'
const otherId = '9d113102-69c3-436b-ab9b-45f65f47ed4a'

function fixture() {
  const upsert = vi.fn().mockResolvedValue({})
  const findMany = vi.fn().mockResolvedValue([])
  const database = {
    notificationPreference: { upsert, findMany },
  } as unknown as PrismaClient
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  registerCommunicationPreferenceRoutes(
    app,
    () => database,
    async (request, reply) => {
      if (!request.headers['x-user']) return reply.code(401).send()
      request.currentUser = { id: userId } as User
    },
  )
  app.setErrorHandler((error, _request, reply) =>
    reply.code(error instanceof ZodError ? 400 : 500).send(),
  )
  return { app, upsert, findMany }
}

describe('communication preference routes', () => {
  it('reads only the authenticated user and denies anonymous access', async () => {
    const { app, findMany } = fixture()
    try {
      expect(
        (await app.inject('/me/notification-preferences')).statusCode,
      ).toBe(401)
      const response = await app.inject({
        url: `/me/notification-preferences?userId=${otherId}`,
        headers: { 'x-user': userId },
      })
      expect(response.statusCode).toBe(200)
      expect(findMany).toHaveBeenCalledWith({ where: { userId } })
      expect(response.json().preferences).toHaveLength(8)
    } finally {
      await app.close()
    }
  })

  it('rejects cross-user input and mandatory-security disablement', async () => {
    const { app, upsert } = fixture()
    try {
      const put = (category: string, payload: unknown) =>
        app.inject({
          method: 'PUT',
          url: `/me/notification-preferences/${category}`,
          headers: { 'x-user': userId },
          payload,
        })
      expect(
        (
          await put('support', {
            userId: otherId,
            inAppEnabled: true,
            emailEnabled: false,
          })
        ).statusCode,
      ).toBe(400)
      expect(
        (
          await put('accountSecurity', {
            inAppEnabled: false,
            emailEnabled: false,
          })
        ).statusCode,
      ).toBe(400)
      expect(upsert).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('validates email and digest combinations for own settings', async () => {
    const { app, upsert } = fixture()
    try {
      const put = (category: string, emailEnabled: boolean) =>
        app.inject({
          method: 'PUT',
          url: `/me/notification-preferences/${category}`,
          headers: { 'x-user': userId },
          payload: {
            inAppEnabled: true,
            emailEnabled,
            digestCadence: 'daily',
          },
        })
      expect((await put('schoolAnnouncements', false)).statusCode).toBe(400)
      expect((await put('support', true)).statusCode).toBe(400)
      expect((await put('schoolAnnouncements', true)).statusCode).toBe(200)
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_category: { userId, category: 'schoolAnnouncements' },
          },
          create: expect.objectContaining({ digestCadence: 'daily' }),
        }),
      )
    } finally {
      await app.close()
    }
  })
})
