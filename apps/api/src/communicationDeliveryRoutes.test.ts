import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { ZodError } from 'zod'
import { describe, expect, it, vi } from 'vitest'
import { registerCommunicationDeliveryRoutes } from './communicationDeliveryRoutes.js'

const userId = '3e480e62-47d7-4525-9d88-b8891e56fac0'
const otherId = '9d113102-69c3-436b-ab9b-45f65f47ed4a'
const firstId = '0a45f921-717c-4f53-8da9-b0fd77d233ab'
const secondId = '46a6756f-7277-4d61-8b28-c3f2097a9612'

function fixture() {
  const findMany = vi.fn().mockResolvedValue([])
  const database = { emailDelivery: { findMany } } as unknown as PrismaClient
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  registerCommunicationDeliveryRoutes(
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
  return { app, findMany }
}

describe('communication delivery routes', () => {
  it('requires authentication and rejects another user identifier', async () => {
    const { app, findMany } = fixture()
    try {
      expect((await app.inject('/me/email-deliveries')).statusCode).toBe(401)
      expect(
        (
          await app.inject({
            url: `/me/email-deliveries?userId=${otherId}`,
            headers: { 'x-user': userId },
          })
        ).statusCode,
      ).toBe(400)
      expect(findMany).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('scopes paginated results and returns only safe fields', async () => {
    const { app, findMany } = fixture()
    findMany.mockResolvedValue([
      {
        id: firstId,
        templateKey: 'accountRecovery',
        status: 'sending',
        createdAt: new Date('2026-09-27T00:00:00.000Z'),
        sentAt: null,
        recipientAddress: 'private@example.test',
        providerMessageId: 'private-provider-id',
        failureCode: 'private-failure',
      },
      {
        id: secondId,
        templateKey: 'notificationUpdate',
        status: 'sent',
        createdAt: new Date('2026-09-26T00:00:00.000Z'),
        sentAt: new Date('2026-09-26T00:01:00.000Z'),
      },
    ])
    try {
      const response = await app.inject({
        url: `/me/email-deliveries?take=1&cursor=${secondId}`,
        headers: { 'x-user': userId },
      })
      expect(response.statusCode).toBe(200)
      expect(findMany).toHaveBeenCalledWith({
        where: { recipientUserId: userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 2,
        cursor: { id: secondId },
        skip: 1,
        select: {
          id: true,
          templateKey: true,
          status: true,
          createdAt: true,
          sentAt: true,
        },
      })
      expect(response.json()).toEqual({
        deliveries: [
          {
            id: firstId,
            kind: 'Account recovery',
            status: 'queued',
            createdAt: '2026-09-27T00:00:00.000Z',
            sentAt: null,
          },
        ],
        nextCursor: firstId,
      })
      expect(response.body).not.toContain('private')
    } finally {
      await app.close()
    }
  })
})
