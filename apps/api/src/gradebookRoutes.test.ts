import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { describe, expect, it, vi } from 'vitest'
import { registerGradebookRoutes } from './gradebookRoutes.js'

const schoolId = '00000000-0000-4000-8000-000000000001'
const actorId = '00000000-0000-4000-8000-000000000002'
const yearId = '00000000-0000-4000-8000-000000000003'
const classId = '00000000-0000-4000-8000-000000000004'
const subjectId = '00000000-0000-4000-8000-000000000005'
const periodId = '00000000-0000-4000-8000-000000000007'
const context = `academicYearId=${yearId}&gradingPeriodId=${periodId}&schoolClassId=${classId}&subjectId=${subjectId}`

function fixture(
  role: 'administrator' | 'teacher' | 'student' | 'none',
  assigned = true,
) {
  const preview = vi
    .fn()
    .mockResolvedValue({ status: 'draft', assessments: [] })
  const assignment = vi
    .fn()
    .mockResolvedValue(assigned ? { id: 'assignment' } : null)
  const database = {
    school: {
      findUnique: vi.fn().mockResolvedValue({ organizationId: schoolId }),
    },
    organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    schoolMembership: {
      findUnique: vi.fn().mockResolvedValue(
        role === 'none'
          ? null
          : {
              role,
              startsAt: new Date('2026-01-01'),
              endsAt: null,
            },
      ),
    },
    teachingAssignment: { findFirst: assignment },
    resultSet: { findUnique: preview },
    assessment: { findFirst: vi.fn().mockResolvedValue(null) },
  } as unknown as PrismaClient
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  registerGradebookRoutes(
    app,
    () => database,
    async (request, reply) => {
      if (!request.headers['x-user']) return reply.code(401).send()
      request.currentUser = { id: actorId } as User
    },
  )
  return { app, assignment }
}

describe('gradebook administration API scope', () => {
  it('requires authentication', async () => {
    const { app } = fixture('administrator')
    try {
      const response = await app.inject({
        url: `/schools/${schoolId}/gradebook?${context}`,
      })
      expect(response.statusCode).toBe(401)
    } finally {
      await app.close()
    }
  })

  it('denies students, unrelated actors, and teachers without an exact assignment', async () => {
    for (const [role, assigned] of [
      ['student', true],
      ['none', true],
      ['teacher', false],
    ] as const) {
      const { app } = fixture(role, assigned)
      try {
        const response = await app.inject({
          url: `/schools/${schoolId}/gradebook?${context}`,
          headers: { 'x-user': actorId },
        })
        expect(response.statusCode).toBe(403)
      } finally {
        await app.close()
      }
    }
  })

  it('denies teacher review and lock while checking the exact class assignment', async () => {
    const { app, assignment } = fixture('teacher')
    try {
      const lock = await app.inject({
        method: 'POST',
        url: `/schools/${schoolId}/gradebook/lock`,
        headers: { 'x-user': actorId },
        payload: {
          academicYearId: yearId,
          gradingPeriodId: periodId,
          schoolClassId: classId,
          subjectId,
        },
      })
      expect(lock.statusCode).toBe(403)
      const review = await app.inject({
        method: 'POST',
        url: `/schools/${schoolId}/gradebook/moderation/00000000-0000-4000-8000-000000000006/review`,
        headers: { 'x-user': actorId },
        payload: { decision: 'approved' },
      })
      expect(review.statusCode).toBe(403)
      const gradebook = await app.inject({
        url: `/schools/${schoolId}/gradebook?${context}`,
        headers: { 'x-user': actorId },
      })
      expect(gradebook.statusCode).not.toBe(403)
      expect(assignment).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            schoolId,
            academicYearId: yearId,
            schoolClassId: classId,
            subjectId,
          }),
        }),
      )
    } finally {
      await app.close()
    }
  })
})
