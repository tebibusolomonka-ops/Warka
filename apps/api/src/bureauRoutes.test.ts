import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { describe, expect, it, vi } from 'vitest'
import { registerBureauRoutes } from './bureauRoutes.js'

vi.setConfig({ testTimeout: 15_000 })

const userId = '91c9a88f-1546-4ac6-9c9c-a9410f2f32bd'
const organizationId = '813787ea-6f4f-4b17-bbed-9b0901f3379c'
const periodId = 'a9bb4d8f-d490-48a3-90d0-35571b94fb3e'
const schoolId = '660daf71-3652-4a57-abaa-306c651bf44b'

function testApp(database: Record<string, unknown>) {
  const app = Fastify()
  registerBureauRoutes(
    app,
    () => database as unknown as PrismaClient,
    async (request) => {
      request.currentUser = { id: userId } as User
    },
  )
  app.setErrorHandler((_error, _request, reply) =>
    reply.code(403).send({ denied: true }),
  )
  return app
}

describe('bureau reporting authorization routes', () => {
  it('lets a viewer read within scope but denies period creation and approval', async () => {
    const database = {
      bureauAccess: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ role: 'viewer', revokedAt: null }),
      },
      reportingPeriod: { findMany: vi.fn().mockResolvedValue([]) },
      reportingSubmission: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          status: 'submitted',
          reportingPeriod: { organizationId },
        }),
      },
    }
    const app = testApp(database)
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/bureau/${organizationId}/periods`,
        })
      ).statusCode,
    ).toBe(200)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/bureau/${organizationId}/periods`,
          payload: {
            name: 'Term',
            startsOn: '2026-01-01',
            endsOn: '2026-06-30',
            submissionDueOn: '2026-07-10',
          },
        })
      ).statusCode,
    ).toBe(403)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/bureau/${organizationId}/submissions/52eb26d2-bb55-43b3-9a8d-a743a68d6f28/approve`,
        })
      ).statusCode,
    ).toBe(403)
    await app.close()
  })

  it('lets a report manager create periods and approve within scope', async () => {
    const database = {
      bureauAccess: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ role: 'reportManager', revokedAt: null }),
      },
      reportingPeriod: { create: vi.fn().mockResolvedValue({ id: periodId }) },
      reportingSubmission: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          status: 'submitted',
          reportingPeriod: { organizationId },
        }),
        update: vi.fn().mockResolvedValue({ status: 'approved' }),
      },
    }
    const app = testApp(database)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/bureau/${organizationId}/periods`,
          payload: {
            name: 'Term',
            startsOn: '2026-01-01',
            endsOn: '2026-06-30',
            submissionDueOn: '2026-07-10',
          },
        })
      ).statusCode,
    ).toBe(200)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/bureau/${organizationId}/submissions/52eb26d2-bb55-43b3-9a8d-a743a68d6f28/approve`,
        })
      ).statusCode,
    ).toBe(200)
    await app.close()
  })

  it.each(['administrator', 'registrar'] as const)(
    'allows a %s to submit only for their school',
    async (role) => {
      const database = {
        schoolMembership: { findUnique: vi.fn().mockResolvedValue({ role }) },
        reportingPeriod: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({ status: 'open' }),
        },
        reportingSubmission: {
          update: vi.fn().mockResolvedValue({ status: 'submitted' }),
        },
      }
      const app = testApp(database)
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/schools/${schoolId}/reporting/${periodId}/submit`,
          })
        ).statusCode,
      ).toBe(200)
      expect(database.reportingSubmission.update).toHaveBeenCalled()
      await app.close()
    },
  )

  it.each(['teacher', 'student', 'guardian'] as const)(
    'denies %s submission without an authorized school role',
    async () => {
      const database = {
        schoolMembership: { findUnique: vi.fn().mockResolvedValue(null) },
        reportingPeriod: { findUniqueOrThrow: vi.fn() },
        reportingSubmission: { update: vi.fn() },
      }
      const app = testApp(database)
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/schools/${schoolId}/reporting/${periodId}/submit`,
          })
        ).statusCode,
      ).toBe(403)
      expect(database.reportingSubmission.update).not.toHaveBeenCalled()
      await app.close()
    },
  )

  it('does not let bureau access expose school staff reporting records', async () => {
    const database = {
      school: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ organizationId }),
      },
      schoolMembership: { findUnique: vi.fn().mockResolvedValue(null) },
      organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
      reportingRequirement: { findMany: vi.fn() },
    }
    const app = testApp(database)
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/schools/${schoolId}/reporting`,
        })
      ).statusCode,
    ).toBe(403)
    expect(database.reportingRequirement.findMany).not.toHaveBeenCalled()
    await app.close()
  })
})
