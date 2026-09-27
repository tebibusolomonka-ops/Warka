import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerEmailAdministrationRoutes } from './emailAdministrationRoutes.js'

const actorId = '3e480e62-47d7-4525-9d88-b8891e56fac0'
const deliveryId = '123e4567-e89b-42d3-a456-426614174001'

function fixture(owner: boolean) {
  const auditCreate = vi.fn().mockResolvedValue({})
  const database = {
    organizationMembership: {
      findFirst: vi.fn().mockResolvedValue(owner ? { userId: actorId } : null),
    },
    emailDelivery: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: deliveryId,
          recipientAddress: 'recipient@example.test',
          templateKey: 'accountRecovery',
          status: 'failed',
          createdAt: new Date(),
          scheduledAt: new Date(),
          attemptCount: 1,
          failureCode: 'UNAVAILABLE',
          recoveryRequest: {
            status: 'pending',
            expiresAt: new Date(Date.now() + 60000),
          },
        },
      ]),
    },
    $transaction: (work: (transaction: unknown) => Promise<unknown>) =>
      work({
        auditEvent: { create: auditCreate },
        emailDelivery: {
          findUnique: vi.fn().mockResolvedValue({
            status: 'failed',
            failureCode: 'UNAVAILABLE',
            attemptCount: 1,
            recoveryRequest: null,
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        scheduledTaskExecution: {
          findFirst: vi.fn().mockResolvedValue({
            seriesId: '123e4567-e89b-42d3-a456-426614174002',
            attempt: 1,
            status: 'failed',
          }),
          create: vi.fn().mockResolvedValue({}),
        },
      }),
  } as unknown as PrismaClient
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  registerEmailAdministrationRoutes(
    app,
    () => database,
    async (request, reply) => {
      if (!request.headers['x-user']) return reply.code(401).send()
      request.currentUser = { id: actorId } as User
    },
  )
  app.setErrorHandler((_error, _request, reply) => reply.code(403).send())
  return { app, auditCreate }
}

afterEach(() => vi.unstubAllEnvs())

describe('email administration routes', () => {
  it('denies anonymous and non-operator access', async () => {
    vi.stubEnv('WARKA_OPERATOR_USER_IDS', actorId)
    const { app } = fixture(false)
    try {
      expect(
        (await app.inject('/operations/email/deliveries')).statusCode,
      ).toBe(401)
      expect(
        (
          await app.inject({
            url: '/operations/email/deliveries',
            headers: { 'x-user': actorId },
          })
        ).statusCode,
      ).toBe(403)
    } finally {
      await app.close()
    }
  })

  it('shows safe metadata without message bodies or recovery tokens', async () => {
    vi.stubEnv('WARKA_OPERATOR_USER_IDS', actorId)
    const { app, auditCreate } = fixture(true)
    try {
      const response = await app.inject({
        url: '/operations/email/deliveries',
        headers: { 'x-user': actorId },
      })
      expect(response.statusCode).toBe(200)
      expect(response.json().deliveries[0]).toMatchObject({
        recipient: 'r***@example.test',
        retryEligible: true,
      })
      expect(response.body).not.toContain('recipient@example.test')
      expect(response.body).not.toContain('recoveryToken')
      expect(response.body).not.toContain('providerMessageId')
      const retry = await app.inject({
        method: 'POST',
        url: `/operations/email/deliveries/${deliveryId}/retry`,
        headers: { 'x-user': actorId },
      })
      expect(retry.statusCode).toBe(202)
      expect(auditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'emailDelivery.retryRequested',
          actorUserId: actorId,
          resourceId: deliveryId,
          metadata: { attempt: 2 },
        }),
      })
      expect(JSON.stringify(auditCreate.mock.calls)).not.toContain('token')
    } finally {
      await app.close()
    }
  })
})
