import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerOperationsRoutes } from './operationsRoutes.js'
import { ServiceMetrics } from './serviceMetrics.js'

const actorId = '3e480e62-47d7-4525-9d88-b8891e56fac0'

function fixture(owner: boolean) {
  const database = {
    organizationMembership: {
      findFirst: vi.fn().mockResolvedValue(owner ? { userId: actorId } : null),
    },
    backupRecord: {
      findFirst: vi
        .fn()
        .mockResolvedValue({
          id: 'backup',
          status: 'verified',
          createdAt: new Date(),
          verifiedAt: new Date(),
          verificationResult: 'passed',
        }),
    },
    restoreRehearsal: { findFirst: vi.fn().mockResolvedValue(null) },
    operationalIncident: { findMany: vi.fn().mockResolvedValue([]) },
    maintenanceWindow: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaClient
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  registerOperationsRoutes(
    app,
    () => database,
    async (request, reply) => {
      if (!request.headers['x-user']) return reply.code(401).send()
      request.currentUser = { id: actorId } as User
    },
    new ServiceMetrics(),
    async () => ({
      status: 'ready',
      dependencies: {
        database: 'ready',
        documentRenderer: 'ready',
        backupStorage: 'ready',
      },
    }),
  )
  app.setErrorHandler((_error, _request, reply) => reply.code(403).send())
  return app
}

afterEach(() => vi.unstubAllEnvs())

describe('operations status API', () => {
  it('denies unauthenticated and ordinary school users', async () => {
    vi.stubEnv('WARKA_OPERATOR_USER_IDS', actorId)
    const app = fixture(false)
    expect((await app.inject('/operations/status')).statusCode).toBe(401)
    expect(
      (
        await app.inject({
          url: '/operations/status',
          headers: { 'x-user': actorId },
        })
      ).statusCode,
    ).toBe(403)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/operations/incidents',
          headers: { 'x-user': actorId },
          payload: {
            severity: 'high',
            title: 'Outage',
            summary: 'Service unavailable',
          },
        })
      ).statusCode,
    ).toBe(403)
    await app.close()
  })

  it('returns a safe aggregate to an authorized operator', async () => {
    vi.stubEnv('WARKA_OPERATOR_USER_IDS', actorId)
    const app = fixture(true)
    const response = await app.inject({
      url: '/operations/status',
      headers: { 'x-user': actorId },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().recentBackup.status).toBe('verified')
    expect(response.body).not.toContain('storageReference')
    expect(response.body).not.toContain('DATABASE_URL')
    await app.close()
  })
})
