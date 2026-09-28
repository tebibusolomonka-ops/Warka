import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { describe, expect, it, vi } from 'vitest'
import { registerAttendanceRoutes } from './attendanceRoutes.js'

const schoolId = '00000000-0000-4000-8000-000000000001'
const studentId = '00000000-0000-4000-8000-000000000002'
const actorId = '00000000-0000-4000-8000-000000000003'

function fixture(own: boolean) {
  const findMany = vi.fn().mockResolvedValue([
    {
      id: studentId,
      status: 'present',
      session: {
        date: new Date('2026-09-28'),
        schoolClass: { name: 'A' },
        subject: null,
      },
    },
  ])
  const database = {
    studentAccess: {
      findUnique: vi.fn().mockResolvedValue(own ? { studentId } : null),
    },
    guardianAccess: { findUnique: vi.fn().mockResolvedValue(null) },
    schoolMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    studentAttendanceRecord: { findMany },
  } as unknown as PrismaClient
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  registerAttendanceRoutes(
    app,
    () => database,
    async (request, reply) => {
      if (!request.headers['x-user']) return reply.code(401).send()
      request.currentUser = { id: actorId } as User
    },
  )
  return { app, findMany }
}

describe('attendance history API', () => {
  it('allows the student only their own finalized history', async () => {
    const { app, findMany } = fixture(true)
    try {
      const url = `/schools/${schoolId}/attendance/students/${studentId}/history`
      expect((await app.inject(url)).statusCode).toBe(401)
      const response = await app.inject({ url, headers: { 'x-user': actorId } })
      expect(response.statusCode).toBe(200)
      expect(response.json().records[0]).toEqual(
        expect.objectContaining({ status: 'present', className: 'A' }),
      )
      expect(response.json().records[0]).not.toHaveProperty('note')
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { schoolId, studentId, session: { status: 'finalized' } },
        }),
      )
    } finally {
      await app.close()
    }
  })

  it('denies an unrelated account before querying attendance', async () => {
    const { app, findMany } = fixture(false)
    try {
      const response = await app.inject({
        url: `/schools/${schoolId}/attendance/students/${studentId}/history`,
        headers: { 'x-user': actorId },
      })
      expect(response.statusCode).toBe(403)
      expect(findMany).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('requires a verified guardian link before returning child attendance', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const database = {
      guardianAccess: {
        findUnique: vi.fn().mockResolvedValue({ guardianId: actorId }),
      },
      student: { findUnique: vi.fn().mockResolvedValue({ id: studentId }) },
      studentGuardian: { findFirst: vi.fn().mockResolvedValue(null) },
      studentAttendanceRecord: { findMany },
    } as unknown as PrismaClient
    const app = Fastify()
    app.decorateRequest('currentUser', null)
    registerAttendanceRoutes(
      app,
      () => database,
      async (request) => {
        request.currentUser = { id: actorId } as User
      },
    )
    try {
      const response = await app.inject(
        `/parent/children/CHILD-1/attendance?schoolId=${schoolId}`,
      )
      expect(response.statusCode).toBe(403)
      expect(findMany).not.toHaveBeenCalled()
      expect(database.studentGuardian.findFirst).toHaveBeenCalledWith({
        where: {
          guardianId: actorId,
          studentId,
          verificationStatus: 'verified',
          verificationSchoolId: schoolId,
          revokedAt: null,
        },
      })
    } finally {
      await app.close()
    }
  })
})
