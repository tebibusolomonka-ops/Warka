import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { describe, expect, it, vi } from 'vitest'
import { registerAcademicProgressRoutes } from './academicProgressRoutes.js'
import { eligibleParentChildren } from './parentPortalService.js'

vi.mock('./parentPortalService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./parentPortalService.js')>()),
  eligibleParentChildren: vi.fn(),
}))
const userId = '00000000-0000-4000-8000-000000000001'
const studentId = '00000000-0000-4000-8000-000000000002'
const schoolId = '00000000-0000-4000-8000-000000000003'
function fixture(linked: boolean) {
  const published = vi
    .fn()
    .mockResolvedValue([{ resultSet: { subject: { name: 'Mathematics' } } }])
  const schedules = vi.fn().mockResolvedValue([
    {
      id: 'schedule',
      scheduledDate: new Date('2026-10-01'),
      startTime: '09:00',
      endTime: '10:00',
      assessment: { name: 'Unit test' },
      subject: { name: 'Mathematics' },
    },
  ])
  const database = {
    studentAccess: {
      findUnique: vi.fn().mockResolvedValue(linked ? { studentId } : null),
    },
    enrollment: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'enrollment',
          schoolId,
          academicYearId: 'year',
          schoolClassId: 'class',
        },
      ]),
    },
    publishedResult: { findMany: published },
    assessmentParticipation: { count: vi.fn().mockResolvedValue(2) },
    assessmentSchedule: { findMany: schedules },
  } as unknown as PrismaClient
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  registerAcademicProgressRoutes(
    app,
    () => database,
    async (request, reply) => {
      if (!request.headers['x-user']) return reply.code(401).send()
      request.currentUser = { id: userId } as User
    },
  )
  return { app, published, schedules }
}

describe('academic progress scope', () => {
  it('requires authentication and an actual student link', async () => {
    const { app } = fixture(false)
    try {
      expect((await app.inject({ url: '/student/progress' })).statusCode).toBe(
        401,
      )
      expect(
        (
          await app.inject({
            url: '/student/progress',
            headers: { 'x-user': userId },
          })
        ).statusCode,
      ).toBe(403)
    } finally {
      await app.close()
    }
  })
  it('returns only published result counts and scheduled assessments for the linked student', async () => {
    const { app, published, schedules } = fixture(true)
    try {
      const response = await app.inject({
        url: '/student/progress',
        headers: { 'x-user': userId },
      })
      expect(response.statusCode).toBe(200)
      expect(response.json()).toMatchObject({
        completedAssessments: 2,
        publishedResultsAvailable: 1,
        subjectsWithPublishedResults: ['Mathematics'],
        upcomingAssessments: [{ name: 'Unit test' }],
      })
      expect(published).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            studentId,
            resultSet: { status: 'published', publishedAt: { not: null } },
          }),
        }),
      )
      expect(schedules).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'scheduled' }),
        }),
      )
    } finally {
      await app.close()
    }
  })
  it('denies an unlinked child reference before reading progress', async () => {
    vi.mocked(eligibleParentChildren).mockResolvedValue([])
    const { app, published } = fixture(true)
    try {
      const response = await app.inject({
        url: '/parent/children/OTHER/progress',
        headers: { 'x-user': userId },
      })
      expect(response.statusCode).toBe(403)
      expect(published).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })
  it('limits a verified linked child summary to the verified school', async () => {
    vi.mocked(eligibleParentChildren).mockResolvedValue([
      {
        studentReference: 'CHILD',
        studentId,
        schoolId,
      } as Awaited<ReturnType<typeof eligibleParentChildren>>[number],
    ])
    const { app, published } = fixture(false)
    try {
      const response = await app.inject({
        url: '/parent/children/CHILD/progress',
        headers: { 'x-user': userId },
      })
      expect(response.statusCode).toBe(200)
      expect(published).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ studentId, schoolId }),
        }),
      )
    } finally {
      await app.close()
    }
  })
})
