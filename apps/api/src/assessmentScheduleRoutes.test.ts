import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { AcademicYearClosingPermissionError } from '@warka/database'
import { describe, expect, it, vi } from 'vitest'
import { registerAssessmentScheduleRoutes } from './assessmentScheduleRoutes.js'

const schoolId = '00000000-0000-4000-8000-000000000001'
const otherSchoolId = '00000000-0000-4000-8000-000000000002'
const actorId = '00000000-0000-4000-8000-000000000003'
const yearId = '00000000-0000-4000-8000-000000000004'
const classId = '00000000-0000-4000-8000-000000000005'
const subjectId = '00000000-0000-4000-8000-000000000006'
const activeMembership = {
  role: 'administrator',
  startsAt: new Date('2026-01-01'),
  endsAt: null,
}

function fixture(role: 'administrator' | 'teacher' | 'none') {
  const roomCreate = vi.fn().mockResolvedValue({ id: 'room', schoolId })
  const scheduleList = vi.fn().mockResolvedValue([])
  const membership = vi
    .fn()
    .mockImplementation(
      async ({
        where,
      }: {
        where: { userId_schoolId: { schoolId: string } }
      }) =>
        where.userId_schoolId.schoolId === schoolId && role !== 'none'
          ? { ...activeMembership, role }
          : null,
    )
  const assignment = vi.fn().mockResolvedValue({ id: 'assignment' })
  const database = {
    school: {
      findUnique: vi.fn().mockResolvedValue({ organizationId: schoolId }),
    },
    organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    schoolMembership: { findUnique: membership },
    teachingAssignment: {
      findFirst: assignment,
      findMany: vi.fn().mockResolvedValue([]),
    },
    assessmentRoom: { create: roomCreate },
    assessmentSchedule: { findMany: scheduleList },
  } as unknown as PrismaClient
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AcademicYearClosingPermissionError)
      return reply.code(403).send()
    return reply.code(500).send({ error: error.message })
  })
  registerAssessmentScheduleRoutes(
    app,
    () => database,
    async (request, reply) => {
      if (!request.headers['x-user']) return reply.code(401).send()
      request.currentUser = { id: actorId } as User
    },
  )
  return { app, roomCreate, scheduleList, assignment }
}

describe('assessment administration API', () => {
  it('requires authentication before creating a room', async () => {
    const { app, roomCreate } = fixture('administrator')
    try {
      const response = await app.inject({
        method: 'POST',
        url: `/schools/${schoolId}/assessment-rooms`,
        payload: { name: 'Hall', code: 'H1' },
      })
      expect(response.statusCode).toBe(401)
      expect(roomCreate).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('denies bureau-only and cross-school administration', async () => {
    const { app, roomCreate } = fixture('none')
    try {
      for (const target of [schoolId, otherSchoolId]) {
        const response = await app.inject({
          method: 'POST',
          url: `/schools/${target}/assessment-rooms`,
          headers: { 'x-user': actorId },
          payload: { name: 'Hall', code: 'H1' },
        })
        expect(response.statusCode).toBe(403)
      }
      expect(roomCreate).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('scopes room creation to the administrator school', async () => {
    const { app, roomCreate } = fixture('administrator')
    try {
      const response = await app.inject({
        method: 'POST',
        url: `/schools/${schoolId}/assessment-rooms`,
        headers: { 'x-user': actorId },
        payload: { name: 'Hall', code: 'H1', capacity: 40 },
      })
      expect(response.statusCode).toBe(201)
      expect(roomCreate).toHaveBeenCalledWith({
        data: { schoolId, name: 'Hall', code: 'H1', capacity: 40 },
      })
    } finally {
      await app.close()
    }
  })

  it('requires an exact active assignment for a teacher class and subject calendar', async () => {
    const { app, scheduleList, assignment } = fixture('teacher')
    try {
      const base = `/schools/${schoolId}/assessment-calendar?academicYearId=${yearId}&schoolClassId=${classId}`
      expect(
        (await app.inject({ url: base, headers: { 'x-user': actorId } }))
          .statusCode,
      ).toBe(403)
      const response = await app.inject({
        url: `${base}&subjectId=${subjectId}`,
        headers: { 'x-user': actorId },
      })
      expect(response.statusCode).toBe(200)
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
      expect(scheduleList).toHaveBeenCalledWith(
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
