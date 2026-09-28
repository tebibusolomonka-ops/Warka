import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ZodError } from 'zod'
import {
  mayManageCourseworkAssignment,
  visibleCourseworkAssignmentForStudent,
  startCourseworkSubmission,
  findSchoolMembership,
} from '@warka/database'
import {
  CourseworkRouteAccessError,
  registerCourseworkRoutes,
} from './courseworkRoutes.js'

vi.mock('@warka/database', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@warka/database')>()),
  mayManageCourseworkAssignment: vi.fn(),
  visibleCourseworkAssignmentForStudent: vi.fn(),
  startCourseworkSubmission: vi.fn(),
  findSchoolMembership: vi.fn(),
}))
const schoolId = '00000000-0000-4000-8000-000000000001'
const assignmentId = '00000000-0000-4000-8000-000000000002'
const actorId = '00000000-0000-4000-8000-000000000003'
function fixture() {
  const database = {
    courseworkAssignment: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: assignmentId, schoolId, status: 'published' }),
      findMany: vi.fn().mockResolvedValue([{ id: assignmentId, schoolId }]),
    },
  } as unknown as PrismaClient
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  registerCourseworkRoutes(
    app,
    () => database,
    async (request, reply) => {
      if (!request.headers['x-user']) return reply.code(401).send()
      request.currentUser = { id: actorId } as User
    },
  )
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({ error: 'invalid input' })
    if (error instanceof CourseworkRouteAccessError)
      return reply.code(404).send({ error: 'not found' })
    return reply.code(500).send({ error: error.message })
  })
  return { app, database }
}
beforeEach(() => {
  vi.mocked(mayManageCourseworkAssignment).mockReset().mockResolvedValue(false)
  vi.mocked(visibleCourseworkAssignmentForStudent)
    .mockReset()
    .mockResolvedValue(null)
  vi.mocked(startCourseworkSubmission)
    .mockReset()
    .mockResolvedValue({ id: assignmentId } as never)
  vi.mocked(findSchoolMembership).mockReset().mockResolvedValue(null)
})
describe('coursework API authorization', () => {
  it('requires authentication and hides assignments outside the student audience', async () => {
    const { app } = fixture()
    try {
      expect(
        (await app.inject(`/student/coursework/${assignmentId}`)).statusCode,
      ).toBe(401)
      expect(
        (
          await app.inject({
            url: `/student/coursework/${assignmentId}`,
            headers: { 'x-user': actorId },
          })
        ).statusCode,
      ).toBe(404)
    } finally {
      await app.close()
    }
  })
  it('hides another teacher assignment and their submissions', async () => {
    const { app } = fixture()
    try {
      expect(
        (
          await app.inject({
            url: `/schools/${schoolId}/coursework/${assignmentId}`,
            headers: { 'x-user': actorId },
          })
        ).statusCode,
      ).toBe(404)
      expect(
        (
          await app.inject({
            url: `/schools/${schoolId}/coursework`,
            headers: { 'x-user': actorId },
          })
        ).statusCode,
      ).toBe(404)
    } finally {
      await app.close()
    }
  })
  it('uses authenticated identity and no studentId parameter when starting a submission', async () => {
    const { app } = fixture()
    try {
      const response = await app.inject({
        method: 'POST',
        url: `/student/coursework/${assignmentId}/submission`,
        headers: { 'x-user': actorId },
        payload: {},
      })
      expect(response.statusCode).toBe(201)
      expect(startCourseworkSubmission).toHaveBeenCalledWith(
        expect.anything(),
        actorId,
        assignmentId,
      )
      expect(startCourseworkSubmission).not.toHaveBeenCalledWith(
        expect.anything(),
        schoolId,
        assignmentId,
      )
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/student/coursework/${assignmentId}/submission`,
            headers: { 'x-user': actorId },
            payload: { studentId: schoolId },
          })
        ).statusCode,
      ).toBe(400)
    } finally {
      await app.close()
    }
  })
  it('does not expose a generic assignment status mutation', async () => {
    const { app } = fixture()
    try {
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/schools/${schoolId}/coursework/${assignmentId}`,
            headers: { 'x-user': actorId },
            payload: { status: 'published' },
          })
        ).statusCode,
      ).toBe(404)
    } finally {
      await app.close()
    }
  })
})
