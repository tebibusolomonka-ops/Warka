import Fastify from 'fastify'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient, User } from '@warka/database'
import {
  FileAssetAccessError,
  requireFileAssetAccess,
} from './fileAssetAccess.js'
import { registerFileDeliveryRoutes } from './fileDeliveryRoutes.js'
import type { FileStorage } from './fileStorage.js'

vi.mock('./fileAssetAccess.js', async (original) => ({
  ...(await original<typeof import('./fileAssetAccess.js')>()),
  requireFileAssetAccess: vi.fn(),
}))

const schoolId = randomUUID()
const materialId = randomUUID()
const assetId = randomUUID()
const actorId = randomUUID()
const bytes = Buffer.from('%PDF-1.7\nsynthetic')

function fixture() {
  const database = {
    learningMaterial: {
      findFirst: vi.fn().mockResolvedValue({ fileAsset: { id: assetId } }),
    },
    schoolDocumentProfile: {
      findUnique: vi.fn().mockResolvedValue({ logoAssetId: assetId }),
    },
  } as unknown as PrismaClient
  const storage = {
    get: vi
      .fn()
      .mockResolvedValue({
        stream: Readable.from([bytes]),
        sizeBytes: bytes.length,
      }),
  } as unknown as FileStorage
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  registerFileDeliveryRoutes(
    app,
    () => database,
    async (request, reply) => {
      if (!request.headers['x-user']) return reply.code(401).send()
      request.currentUser = { id: actorId } as User
    },
    storage,
  )
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof FileAssetAccessError) return reply.code(404).send()
    return reply.send(error)
  })
  return { app, database, storage }
}

beforeEach(() =>
  vi
    .mocked(requireFileAssetAccess)
    .mockReset()
    .mockResolvedValue({
      id: assetId,
      schoolId,
      storageKey: `asset_${randomUUID()}`,
      contentType: 'application/pdf',
      originalFileName: 'lesson"\r\n.pdf',
    } as never),
)

describe('purpose-bound file delivery', () => {
  it('requires a session and delivers a private material with safe headers', async () => {
    const { app, database, storage } = fixture()
    const url = `/schools/${schoolId}/materials/${materialId}/download`
    try {
      expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401)
      const reply = await app.inject({
        method: 'GET',
        url,
        headers: { 'x-user': actorId },
      })
      expect(reply.statusCode).toBe(200)
      expect(reply.rawPayload).toEqual(bytes)
      expect(reply.headers['content-disposition']).toBe(
        'attachment; filename="lesson___.pdf"',
      )
      expect(reply.headers['content-length']).toBe(String(bytes.length))
      expect(reply.headers['cache-control']).toBe('private, no-store')
      expect(JSON.stringify(reply.headers)).not.toContain('asset_')
      expect(database.learningMaterial.findFirst).toHaveBeenCalledWith({
        where: { id: materialId, schoolId, resourceType: 'file' },
        select: { fileAsset: { select: { id: true } } },
      })
      expect(storage.get).toHaveBeenCalledOnce()
    } finally {
      await app.close()
    }
  })

  it('denies cross-school assets and unavailable material', async () => {
    const { app, database, storage } = fixture()
    const url = `/schools/${schoolId}/materials/${materialId}/download`
    try {
      vi.mocked(requireFileAssetAccess).mockResolvedValueOnce({
        schoolId: randomUUID(),
      } as never)
      expect(
        (
          await app.inject({
            method: 'GET',
            url,
            headers: { 'x-user': actorId },
          })
        ).statusCode,
      ).toBe(404)
      vi.mocked(database.learningMaterial.findFirst).mockResolvedValueOnce(null)
      expect(
        (
          await app.inject({
            method: 'GET',
            url,
            headers: { 'x-user': actorId },
          })
        ).statusCode,
      ).toBe(404)
      vi.mocked(requireFileAssetAccess).mockRejectedValueOnce(
        new FileAssetAccessError(),
      )
      expect(
        (
          await app.inject({
            method: 'GET',
            url,
            headers: { 'x-user': actorId },
          })
        ).statusCode,
      ).toBe(404)
      expect(storage.get).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('delivers only the current school logo', async () => {
    const { app, database } = fixture()
    const url = `/schools/${schoolId}/document-profile/logo`
    try {
      expect(
        (
          await app.inject({
            method: 'GET',
            url,
            headers: { 'x-user': actorId },
          })
        ).statusCode,
      ).toBe(200)
      vi.mocked(
        database.schoolDocumentProfile.findUnique,
      ).mockResolvedValueOnce(null)
      expect(
        (
          await app.inject({
            method: 'GET',
            url,
            headers: { 'x-user': actorId },
          })
        ).statusCode,
      ).toBe(404)
    } finally {
      await app.close()
    }
  })
})
