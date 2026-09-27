import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerQuarantineRoutes } from './quarantineRoutes.js'
import { OperationsPermissionError } from './operationsAccess.js'

const actorId = '3e480e62-47d7-4525-9d88-b8891e56fac0'
const assetId = '441ede62-47d7-4525-9d88-b8891e56fac0'

function fixture(owner: boolean) {
  const database = {
    organizationMembership: {
      findFirst: vi.fn().mockResolvedValue(owner ? { userId: actorId } : null),
    },
    fileScan: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          {
            id: 'scan',
            status: 'infected',
            fileAsset: {
              id: assetId,
              status: 'quarantined',
              originalFileName: 'lesson.pdf',
            },
          },
        ]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'scan2' }),
    },
    fileAsset: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          id: assetId,
          schoolId: null,
          status: 'quarantined',
          scanRequired: true,
          storageKey: 'private-key',
        }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    scheduledTaskExecution: {
      create: vi.fn().mockResolvedValue({ id: 'task' }),
    },
    auditEvent: { create: vi.fn().mockResolvedValue({ id: 'audit' }) },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(database),
    ),
  } as unknown as PrismaClient
  const storage = { delete: vi.fn().mockResolvedValue(undefined) }
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  registerQuarantineRoutes(
    app,
    () => database,
    async (request, reply) => {
      if (!request.headers['x-user']) return reply.code(401).send()
      request.currentUser = { id: actorId } as User
    },
    () => storage as never,
  )
  app.setErrorHandler((error, _request, reply) =>
    reply.code(error instanceof OperationsPermissionError ? 403 : 500).send(),
  )
  return { app, database, storage }
}

afterEach(() => vi.unstubAllEnvs())

describe('quarantine administration', () => {
  it('denies unauthenticated and non-operator users', async () => {
    vi.stubEnv('WARKA_OPERATOR_USER_IDS', actorId)
    const { app, database } = fixture(false)
    expect(
      (await app.inject('/operations/file-security/scans')).statusCode,
    ).toBe(401)
    for (const request of [
      { method: 'GET' as const, url: '/operations/file-security/scans' },
      {
        method: 'POST' as const,
        url: `/operations/file-security/assets/${assetId}/rescan`,
      },
      {
        method: 'DELETE' as const,
        url: `/operations/file-security/assets/${assetId}`,
      },
    ])
      expect(
        (await app.inject({ ...request, headers: { 'x-user': actorId } }))
          .statusCode,
      ).toBe(403)
    expect(database.fileScan.findMany).not.toHaveBeenCalled()
    await app.close()
  })
  it('returns safe metadata and queues a rescan only for an operator', async () => {
    vi.stubEnv('WARKA_OPERATOR_USER_IDS', actorId)
    const { app, database } = fixture(true)
    const response = await app.inject({
      url: '/operations/file-security/scans',
      headers: { 'x-user': actorId },
    })
    expect(response.statusCode).toBe(200)
    expect(response.body).not.toContain('private-key')
    const rescan = await app.inject({
      method: 'POST',
      url: `/operations/file-security/assets/${assetId}/rescan`,
      headers: { 'x-user': actorId },
    })
    expect(rescan.statusCode).toBe(202)
    expect(database.scheduledTaskExecution.create).toHaveBeenCalledOnce()
    await app.close()
  })
  it('removes only a quarantined artifact', async () => {
    vi.stubEnv('WARKA_OPERATOR_USER_IDS', actorId)
    const { app, storage } = fixture(true)
    const response = await app.inject({
      method: 'DELETE',
      url: `/operations/file-security/assets/${assetId}`,
      headers: { 'x-user': actorId },
    })
    expect(response.statusCode).toBe(204)
    expect(storage.delete).toHaveBeenCalledWith('private-key')
    await app.close()
  })
})
