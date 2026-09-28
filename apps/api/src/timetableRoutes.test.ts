import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { describe, expect, it, vi } from 'vitest'
import { registerTimetableRoutes } from './timetableRoutes.js'

const schoolId = '6018184d-34ec-4dce-b0fd-aa1c78a0082c'
const yearId = '7ac67180-a919-4542-b784-90bca7641476'
const userId = 'b17b1b5f-b411-4858-b080-b5f05719e8b6'

function fixture(role: 'teacher' | 'none' = 'teacher') {
  const findMany = vi.fn().mockResolvedValue([{ id: 'own-entry' }])
  const membership = vi
    .fn()
    .mockResolvedValue(role === 'teacher' ? { userId } : null)
  const database = {
    schoolMembership: { findFirst: membership },
    classTimetableEntry: { findMany },
  } as unknown as PrismaClient
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  registerTimetableRoutes(
    app,
    () => database,
    async (request, reply) => {
      if (!request.headers['x-user']) return reply.code(401).send()
      request.currentUser = { id: userId } as User
    },
  )
  return { app, findMany, membership }
}

describe('timetable authorization routes', () => {
  it('requires authentication for teacher schedule', async () => {
    const { app, findMany } = fixture()
    try {
      expect(
        (
          await app.inject(
            `/schools/${schoolId}/timetable/me?academicYearId=${yearId}`,
          )
        ).statusCode,
      ).toBe(401)
      expect(findMany).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('filters published entries by the current active teacher and school', async () => {
    const { app, findMany } = fixture()
    try {
      const response = await app.inject({
        url: `/schools/${schoolId}/timetable/me?academicYearId=${yearId}`,
        headers: { 'x-user': userId },
      })
      expect(response.statusCode).toBe(200)
      expect(findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          schoolId,
          academicYearId: yearId,
          timetable: { status: 'published' },
          teachingAssignment: expect.objectContaining({ userId }),
        }),
        include: expect.any(Object),
        orderBy: expect.any(Array),
      })
    } finally {
      await app.close()
    }
  })

  it('denies a user without active school teaching membership', async () => {
    const { app, findMany } = fixture('none')
    try {
      const response = await app.inject({
        url: `/schools/${schoolId}/timetable/me?academicYearId=${yearId}`,
        headers: { 'x-user': userId },
      })
      expect(response.statusCode).toBe(403)
      expect(findMany).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })
})
