import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerBackupRoutes } from './backupRoutes.js'

const actorId = '3e480e62-47d7-4525-9d88-b8891e56fac0'
const backupId = '526f9981-eb0c-44b4-b13f-e0cb4f899032'

function fixture(owner: boolean) {
  const database = {
    organizationMembership: {
      findFirst: vi.fn().mockResolvedValue(owner ? { userId: actorId } : null),
    },
    backupRecord: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({
        id: backupId,
        scope: 'database',
        status: 'verified',
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        sizeBytes: 12n,
        verifiedAt: new Date(),
        verificationResult: 'passed',
        storageReference: 'secret-path',
      }),
    },
    auditEvent: { create: vi.fn() },
  } as unknown as PrismaClient
  const backup = vi.fn().mockResolvedValue(backupId)
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  registerBackupRoutes(
    app,
    () => database,
    async (request, reply) => {
      if (!request.headers['x-user']) return reply.code(401).send()
      request.currentUser = { id: actorId } as User
    },
    {
      backup,
      storage: () => ({ allocate: vi.fn(), inspect: vi.fn(), remove: vi.fn() }),
    },
  )
  app.setErrorHandler((error, _request, reply) =>
    reply
      .code(error.message === 'Operations access denied' ? 403 : 500)
      .send({ error: error.message }),
  )
  return { app, backup }
}

afterEach(() => vi.unstubAllEnvs())

describe('backup administration routes', () => {
  it('denies unauthenticated, teacher, and unlisted users', async () => {
    vi.stubEnv('WARKA_OPERATOR_USER_IDS', actorId)
    const { app, backup } = fixture(false)
    expect(
      (await app.inject({ method: 'POST', url: '/operations/backups' }))
        .statusCode,
    ).toBe(401)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/operations/backups',
          headers: { 'x-user': actorId },
        })
      ).statusCode,
    ).toBe(403)
    expect(backup).not.toHaveBeenCalled()
    await app.close()
    vi.stubEnv('WARKA_OPERATOR_USER_IDS', '')
    const listedOwner = fixture(true)
    expect(
      (
        await listedOwner.app.inject({
          method: 'GET',
          url: '/operations/backups',
          headers: { 'x-user': actorId },
        })
      ).statusCode,
    ).toBe(403)
    await listedOwner.app.close()
  })

  it('allows a listed active owner and keeps storage references out of responses', async () => {
    vi.stubEnv('WARKA_OPERATOR_USER_IDS', actorId)
    const { app, backup } = fixture(true)
    const headers = { 'x-user': actorId }
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/operations/backups',
          headers,
        })
      ).statusCode,
    ).toBe(200)
    expect(backup).toHaveBeenCalledOnce()
    const response = await app.inject({
      method: 'GET',
      url: `/operations/backups/${backupId}`,
      headers,
    })
    expect(response.statusCode).toBe(200)
    expect(response.body).not.toContain('secret-path')
    expect(response.json().sizeBytes).toBe('12')
    await app.close()
  })
})
