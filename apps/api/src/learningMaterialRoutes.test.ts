import Fastify from 'fastify'
import { randomUUID } from 'node:crypto'
import type { User } from '@warka/database'
import { describe, expect, it, vi } from 'vitest'
import { registerLearningMaterialRoutes } from './learningMaterialRoutes.js'
import type { LearningMaterialService } from './learningMaterialService.js'

const schoolId = randomUUID()
const materialId = randomUUID()
const actorId = randomUUID()

describe('learning material upload route', () => {
  it('requires authentication and forwards only purpose-bound file input', async () => {
    const upload = vi
      .fn()
      .mockResolvedValue({ id: randomUUID(), status: 'available' })
    const materials = { upload } as unknown as LearningMaterialService
    const app = Fastify()
    app.decorateRequest('currentUser', null)
    registerLearningMaterialRoutes(
      app,
      () => materials,
      async (request, reply) => {
        if (!request.headers['x-user']) return reply.code(401).send()
        request.currentUser = { id: actorId } as User
      },
    )
    const url = `/schools/${schoolId}/materials/${materialId}/upload`
    const payload = {
      originalFileName: 'lesson.pdf',
      contentType: 'application/pdf',
      base64: Buffer.from('%PDF-1.7\n').toString('base64'),
    }
    expect(
      (await app.inject({ method: 'POST', url, payload })).statusCode,
    ).toBe(401)
    const response = await app.inject({
      method: 'POST',
      url,
      payload,
      headers: { 'x-user': actorId },
    })
    expect(response.statusCode).toBe(201)
    expect(upload).toHaveBeenCalledWith(
      actorId,
      schoolId,
      materialId,
      expect.objectContaining({
        originalFileName: 'lesson.pdf',
        claimedContentType: 'application/pdf',
      }),
    )
    await app.close()
  })
})
