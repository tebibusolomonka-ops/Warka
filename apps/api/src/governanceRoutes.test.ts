import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  completeAccessReview,
  createRetentionPolicy,
  evaluateRetention,
  getAccessReview,
  hasOrganizationAdminRole,
  listAuditEvents,
  setAccessReviewDecision,
  startAccessReview,
} from '@warka/database'
import { registerGovernanceRoutes } from './governanceRoutes.js'

vi.mock('@warka/database', async (loadOriginal) => {
  const original = await loadOriginal<typeof import('@warka/database')>()
  return {
    ...original,
    completeAccessReview: vi.fn(),
    createRetentionPolicy: vi.fn(),
    evaluateRetention: vi.fn(),
    getAccessReview: vi.fn(),
    hasOrganizationAdminRole: vi.fn(),
    listAuditEvents: vi.fn(),
    setAccessReviewDecision: vi.fn(),
    startAccessReview: vi.fn(),
  }
})

const actorUserId = '3e480e62-47d7-4525-9d88-b8891e56fac0'
const organizationId = '526f9981-eb0c-44b4-b13f-e0cb4f899032'
const reviewId = '2f61e15a-9034-4c9e-bf2b-a7f6df76968c'
const entryId = 'a1503582-1003-4e88-9422-673936e0edbb'

function testApp(database: Record<string, unknown> = {}) {
  const app = Fastify()
  registerGovernanceRoutes(
    app,
    () => database as unknown as PrismaClient,
    async (request, reply) => {
      if (!request.headers['x-user']) return reply.code(401).send()
      request.currentUser = { id: actorUserId } as User
    },
  )
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(hasOrganizationAdminRole).mockResolvedValue(true)
  vi.mocked(listAuditEvents).mockResolvedValue([])
  vi.mocked(startAccessReview).mockResolvedValue({ id: reviewId } as never)
  vi.mocked(getAccessReview).mockResolvedValue({
    id: reviewId,
    organizationId,
    schoolId: null,
    entries: [],
  } as never)
  vi.mocked(setAccessReviewDecision).mockResolvedValue({ id: entryId } as never)
  vi.mocked(completeAccessReview).mockResolvedValue({
    id: reviewId,
    status: 'completed',
  } as never)
  vi.mocked(createRetentionPolicy).mockResolvedValue({
    id: entryId,
    category: 'auditEvents',
    retentionDays: 365,
  } as never)
  vi.mocked(evaluateRetention).mockResolvedValue({
    category: 'auditEvents',
    retentionDays: 365,
    eligibleCount: 0,
  } as never)
})

describe('governance routes', () => {
  it('requires authentication and organization administration for audit history', async () => {
    const app = testApp()
    const url = `/governance/${organizationId}/audit?action=report.approved&take=25`
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401)
    expect(
      (
        await app.inject({
          method: 'GET',
          url,
          headers: { 'x-user': actorUserId },
        })
      ).statusCode,
    ).toBe(200)
    expect(listAuditEvents).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId,
        action: 'report.approved',
        take: 25,
      }),
    )
    vi.mocked(hasOrganizationAdminRole).mockResolvedValue(false)
    expect(
      (
        await app.inject({
          method: 'GET',
          url,
          headers: { 'x-user': actorUserId },
        })
      ).statusCode,
    ).toBe(500)
    await app.close()
  })

  it('binds review creation, decisions, and completion to the session actor', async () => {
    const database = {
      user: { findMany: vi.fn().mockResolvedValue([]) },
    }
    const app = testApp(database)
    const headers = { 'x-user': actorUserId }
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/governance/${organizationId}/reviews`,
          headers,
          payload: {},
        })
      ).statusCode,
    ).toBe(200)
    expect(startAccessReview).toHaveBeenCalledWith(
      expect.anything(),
      actorUserId,
      { organizationId },
    )
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/governance/${organizationId}/reviews/${reviewId}/entries/${entryId}`,
          headers,
          payload: { decision: 'revoke' },
        })
      ).statusCode,
    ).toBe(200)
    expect(setAccessReviewDecision).toHaveBeenCalledWith(
      expect.anything(),
      actorUserId,
      reviewId,
      entryId,
      'revoke',
    )
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/governance/${organizationId}/reviews/${reviewId}/complete`,
          headers,
        })
      ).statusCode,
    ).toBe(200)
    expect(completeAccessReview).toHaveBeenCalledWith(
      expect.anything(),
      actorUserId,
      reviewId,
    )
    await app.close()
  })

  it('saves and evaluates category-specific retention policy metadata', async () => {
    const app = testApp()
    const headers = { 'x-user': actorUserId }
    expect(
      (
        await app.inject({
          method: 'PUT',
          url: `/governance/${organizationId}/retention/auditEvents`,
          headers,
          payload: { retentionDays: 365 },
        })
      ).statusCode,
    ).toBe(200)
    expect(createRetentionPolicy).toHaveBeenCalledWith(
      expect.anything(),
      actorUserId,
      { organizationId, category: 'auditEvents', retentionDays: 365 },
    )
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/governance/${organizationId}/retention/auditEvents/evaluate`,
          headers,
        })
      ).statusCode,
    ).toBe(200)
    expect(evaluateRetention).toHaveBeenCalledWith(
      expect.anything(),
      actorUserId,
      organizationId,
      'auditEvents',
    )
    await app.close()
  })

  it('rejects decisions that could grant access', async () => {
    const app = testApp()
    const response = await app.inject({
      method: 'PATCH',
      url: `/governance/${organizationId}/reviews/${reviewId}/entries/${entryId}`,
      headers: { 'x-user': actorUserId },
      payload: { decision: 'grant' },
    })
    expect(response.statusCode).toBe(500)
    expect(setAccessReviewDecision).not.toHaveBeenCalled()
    await app.close()
  })
})
