import Fastify from 'fastify'
import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient, User } from '@warka/database'
import { registerRecoveryRoutes } from './recoveryRoutes.js'

const actorId = '3e480e62-47d7-4525-9d88-b8891e56fac0'

function fixture(owner: boolean) {
  const database = {
    organizationMembership: {
      findFirst: vi.fn().mockResolvedValue(owner ? { userId: actorId } : null),
    },
    scheduledTaskExecution: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({
        taskType: 'retentionEvaluation',
        attempt: 1,
        recoveryDisposition: 'safeToRetry',
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    recoveryReview: { findMany: vi.fn().mockResolvedValue([]) },
    auditEvent: { create: vi.fn().mockResolvedValue({}) },
  } as unknown as PrismaClient
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  registerRecoveryRoutes(
    app,
    () => database,
    async (request, reply) => {
      if (!request.headers['x-user']) return reply.code(401).send()
      request.currentUser = { id: actorId } as User
    },
  )
  app.setErrorHandler((_error, _request, reply) => reply.code(403).send())
  return { app, database }
}

describe('recovery operations authorization', () => {
  it('denies school users and unauthenticated callers', async () => {
    vi.stubEnv('WARKA_OPERATOR_USER_IDS', actorId)
    const { app } = fixture(false)
    expect(
      (await app.inject('/operations/recovery/executions')).statusCode,
    ).toBe(401)
    expect(
      (
        await app.inject({
          url: '/operations/recovery/reviews',
          headers: { 'x-user': actorId },
        })
      ).statusCode,
    ).toBe(403)
    await app.close()
  })

  it('returns safe metadata and accepts only safe retry classifications', async () => {
    vi.stubEnv('WARKA_OPERATOR_USER_IDS', actorId)
    const { app, database } = fixture(true)
    const list = await app.inject({
      url: '/operations/recovery/executions',
      headers: { 'x-user': actorId },
    })
    expect(list.statusCode).toBe(200)
    expect(list.body).not.toContain('DATABASE_URL')
    expect(list.body).not.toContain('recipientAddress')
    const retry = await app.inject({
      method: 'POST',
      url: '/operations/recovery/executions/713f10d1-1d2f-438b-8af4-85d673466d73/retry',
      headers: { 'x-user': actorId },
    })
    expect(retry.statusCode).toBe(200)
    expect(database.scheduledTaskExecution.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ recoveryDisposition: 'safeToRetry' }),
      }),
    )
    await app.close()
  })
})
