import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerSchedulerRoutes } from './schedulerRoutes.js'

const actorId = '3e480e62-47d7-4525-9d88-b8891e56fac0'
const executionId = '4e480e62-47d7-4525-9d88-b8891e56fac0'

function fixture(owner: boolean, allowed: boolean) {
  vi.stubEnv('WARKA_OPERATOR_USER_IDS', allowed ? actorId : '')
  const database = {
    organizationMembership: {
      findFirst: vi.fn().mockResolvedValue(owner ? { userId: actorId } : null),
    },
    scheduledTaskExecution: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    backupPolicy: { findUnique: vi.fn().mockResolvedValue(null) },
    backupRecord: { findFirst: vi.fn().mockResolvedValue(null) },
    auditEvent: { create: vi.fn().mockResolvedValue({}) },
  } as unknown as PrismaClient
  const retry = vi.fn().mockResolvedValue(true)
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  registerSchedulerRoutes(
    app,
    () => database,
    async (request, reply) => {
      if (!request.headers['x-user']) return reply.code(401).send()
      request.currentUser = { id: actorId } as User
    },
    retry,
  )
  app.setErrorHandler((_error, _request, reply) => reply.code(403).send())
  return { app, database, retry }
}

afterEach(() => vi.unstubAllEnvs())

describe('scheduler administration authorization', () => {
  it('denies unauthenticated, school-admin, and bureau-viewer scope', async () => {
    const ordinary = fixture(false, false)
    expect(
      (await ordinary.app.inject('/operations/scheduler')).statusCode,
    ).toBe(401)
    for (const path of [
      '/operations/scheduler',
      '/operations/scheduler/executions',
      '/operations/scheduler/failures',
      '/operations/scheduler/due-backups',
      '/operations/scheduler/retention-evaluations',
    ])
      expect(
        (
          await ordinary.app.inject({
            url: path,
            headers: { 'x-user': actorId },
          })
        ).statusCode,
      ).toBe(403)
    expect(
      (
        await ordinary.app.inject({
          method: 'POST',
          url: `/operations/scheduler/executions/${executionId}/retry`,
          headers: { 'x-user': actorId },
        })
      ).statusCode,
    ).toBe(403)
    expect(ordinary.retry).not.toHaveBeenCalled()
    await ordinary.app.close()
    const bureau = fixture(true, false)
    expect(
      (
        await bureau.app.inject({
          method: 'POST',
          url: `/operations/scheduler/executions/${executionId}/retry`,
          headers: { 'x-user': actorId },
        })
      ).statusCode,
    ).toBe(403)
    await bureau.app.close()
  })

  it('returns safe status and audits an operator retry', async () => {
    const { app, database, retry } = fixture(true, true)
    const status = await app.inject({
      url: '/operations/scheduler',
      headers: { 'x-user': actorId },
    })
    expect(status.statusCode).toBe(200)
    expect(status.body).not.toContain('DATABASE_URL')
    const due = await app.inject({
      url: '/operations/scheduler/due-backups',
      headers: { 'x-user': actorId },
    })
    expect(due.statusCode).toBe(200)
    const response = await app.inject({
      method: 'POST',
      url: `/operations/scheduler/executions/${executionId}/retry`,
      headers: { 'x-user': actorId },
    })
    expect(response.statusCode).toBe(200)
    expect(retry).toHaveBeenCalledWith(executionId)
    expect(database.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'scheduler.retryRequested' }),
      }),
    )
    await app.close()
  })
})
