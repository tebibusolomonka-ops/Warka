import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  dismissDataQualityIssue,
  evaluateDataQuality,
  requireDataQualityAdministrator,
} from '@warka/database'
import { registerDataQualityRoutes } from './dataQualityRoutes.js'

vi.mock('@warka/database', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@warka/database')>()),
  dismissDataQualityIssue: vi.fn(),
  evaluateDataQuality: vi.fn(),
  requireDataQualityAdministrator: vi.fn(),
}))
const schoolId = '11111111-1111-4111-8111-111111111111'
const actorId = '22222222-2222-4222-8222-222222222222'
const issueId = '33333333-3333-4333-8333-333333333333'
function fixture() {
  const database = {
    dataQualityRun: { findFirst: vi.fn().mockResolvedValue(null) },
    dataQualityIssue: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaClient
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  registerDataQualityRoutes(
    app,
    () => database,
    async (request, reply) => {
      if (!request.headers['x-user']) return reply.code(401).send()
      request.currentUser = { id: String(request.headers['x-user']) } as User
    },
  )
  app.setErrorHandler((error, _request, reply) =>
    reply.code(error instanceof z.ZodError ? 400 : 404).send(),
  )
  return { app, database }
}
beforeEach(() => {
  vi.mocked(requireDataQualityAdministrator)
    .mockReset()
    .mockResolvedValue(undefined)
  vi.mocked(evaluateDataQuality)
    .mockReset()
    .mockResolvedValue({ id: 'run' } as never)
  vi.mocked(dismissDataQualityIssue)
    .mockReset()
    .mockResolvedValue({ id: issueId } as never)
})
describe('data quality administration API', () => {
  it('requires authentication and administrator access for issue lists', async () => {
    const { app } = fixture()
    try {
      const url = `/schools/${schoolId}/data-quality/issues`
      expect((await app.inject(url)).statusCode).toBe(401)
      vi.mocked(requireDataQualityAdministrator).mockRejectedValueOnce(
        new Error('denied'),
      )
      expect(
        (await app.inject({ url, headers: { 'x-user': actorId } })).statusCode,
      ).toBe(404)
      expect(
        (await app.inject({ url, headers: { 'x-user': actorId } })).statusCode,
      ).toBe(200)
    } finally {
      await app.close()
    }
  })
  it('runs only selected checks with session actor and rejects arbitrary issue creation', async () => {
    const { app } = fixture()
    try {
      const headers = { 'x-user': actorId }
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/schools/${schoolId}/data-quality/runs`,
            headers,
            payload: { checks: ['student'] },
          })
        ).statusCode,
      ).toBe(201)
      expect(evaluateDataQuality).toHaveBeenCalledWith(
        expect.anything(),
        { schoolId, trigger: 'manual', checks: ['student'] },
        actorId,
      )
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/schools/${schoolId}/data-quality/issues`,
            headers,
            payload: { code: 'FAKE' },
          })
        ).statusCode,
      ).toBe(404)
    } finally {
      await app.close()
    }
  })
  it('requires a reason and keeps dismissal actor server-controlled', async () => {
    const { app } = fixture()
    try {
      const url = `/schools/${schoolId}/data-quality/issues/${issueId}/dismiss`
      const headers = { 'x-user': actorId }
      expect(
        (
          await app.inject({
            method: 'POST',
            url,
            headers,
            payload: { reason: 'Reviewed' },
          })
        ).statusCode,
      ).toBe(200)
      expect(dismissDataQualityIssue).toHaveBeenCalledWith(
        expect.anything(),
        actorId,
        { schoolId, issueId, reason: 'Reviewed' },
      )
      expect(
        (
          await app.inject({
            method: 'POST',
            url,
            headers,
            payload: { reason: 'Reviewed', dismissedById: issueId },
          })
        ).statusCode,
      ).toBe(400)
    } finally {
      await app.close()
    }
  })
})
