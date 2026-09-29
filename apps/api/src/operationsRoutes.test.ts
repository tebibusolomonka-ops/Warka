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
      findFirst: vi.fn().mockResolvedValue({
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
    fileAsset: {
      aggregate: vi
        .fn()
        .mockResolvedValue({ _count: { id: 2 }, _sum: { sizeBytes: 1024n } }),
      groupBy: vi
        .fn()
        .mockResolvedValue([
          { purpose: 'learningMaterial', _count: { id: 2 } },
        ]),
      count: vi.fn().mockResolvedValue(1),
    },
    fileScan: {
      groupBy: vi
        .fn()
        .mockResolvedValue([{ status: 'infected', _count: { id: 1 } }]),
    },
    emailDelivery: {
      groupBy: vi.fn().mockResolvedValue([
        { status: 'queued', _count: { id: 2 } },
        { status: 'sent', _count: { id: 5 } },
      ]),
    },
    scheduledTaskExecution: { count: vi.fn().mockResolvedValue(1) },
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
      email: 'disabled',
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
    expect((await app.inject('/operations/storage')).statusCode).toBe(401)
    expect((await app.inject('/operations/build')).statusCode).toBe(401)
    expect((await app.inject('/operations/deployment')).statusCode).toBe(401)
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
          url: '/operations/build',
          headers: { 'x-user': actorId },
        })
      ).statusCode,
    ).toBe(403)
    expect(
      (
        await app.inject({
          url: '/operations/deployment',
          headers: { 'x-user': actorId },
        })
      ).statusCode,
    ).toBe(403)
    expect(
      (
        await app.inject({
          url: '/operations/storage',
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
    const deployment = await app.inject({
      url: '/operations/deployment',
      headers: { 'x-user': actorId },
    })
    expect(deployment.statusCode).toBe(200)
    expect(deployment.json()).toHaveProperty('readiness.migration')
    expect(deployment.json()).toHaveProperty('features.emailOutbox')
    expect(deployment.body).not.toContain('DATABASE_URL')
    expect(deployment.body).not.toContain('SMTP_PASSWORD')
    const response = await app.inject({
      url: '/operations/status',
      headers: { 'x-user': actorId },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().recentBackup.status).toBe('verified')
    expect(response.json().fileSecurity.counts.infected).toBe(1)
    expect(response.json().emailDelivery).toEqual({
      provider: 'disabled',
      counts: { queued: 2, sent: 5 },
      retryCount: 1,
    })
    expect(response.body).not.toContain('storageReference')
    expect(response.body).not.toContain('DATABASE_URL')
    const storage = await app.inject({
      url: '/operations/storage',
      headers: { 'x-user': actorId },
    })
    expect(storage.statusCode).toBe(200)
    expect(storage.json()).toEqual({
      availableAssetCount: 2,
      storedBytes: '1024',
      quarantinedAssetCount: 1,
      byPurpose: [{ purpose: 'learningMaterial', count: 2 }],
    })
    expect(storage.body).not.toContain('originalFileName')
    await app.close()
  })
})
