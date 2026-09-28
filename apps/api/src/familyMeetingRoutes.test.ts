import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import {
  findSchoolMembership,
  hasActiveVerifiedGuardianRelationship,
  requestFamilyMeeting,
  scheduleFamilyMeeting,
} from '@warka/database'
import {
  FamilyMeetingRouteAccessError,
  registerFamilyMeetingRoutes,
} from './familyMeetingRoutes.js'

vi.mock('@warka/database', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@warka/database')>()),
  findSchoolMembership: vi.fn(),
  hasActiveVerifiedGuardianRelationship: vi.fn(),
  requestFamilyMeeting: vi.fn(),
  scheduleFamilyMeeting: vi.fn(),
}))
const schoolId = '11111111-1111-4111-8111-111111111111'
const studentId = '22222222-2222-4222-8222-222222222222'
const guardianId = '33333333-3333-4333-8333-333333333333'
const actorId = '44444444-4444-4444-8444-444444444444'
const assignmentId = '55555555-5555-4555-8555-555555555555'
const requestId = '66666666-6666-4666-8666-666666666666'

function fixture() {
  const database = {
    guardianAccess: { findUnique: vi.fn().mockResolvedValue({ guardianId }) },
    enrollment: {
      findFirst: vi.fn().mockResolvedValue({
        academicYearId: schoolId,
        schoolClassId: schoolId,
      }),
    },
    teachingAssignment: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    parentTeacherMeetingRequest: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaClient
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  registerFamilyMeetingRoutes(
    app,
    () => database,
    async (http, reply) => {
      if (!http.headers['x-user']) return reply.code(401).send()
      http.currentUser = { id: String(http.headers['x-user']) } as User
    },
  )
  app.setErrorHandler((error, _http, reply) => {
    if (error instanceof ZodError) return reply.code(400).send()
    if (error instanceof FamilyMeetingRouteAccessError)
      return reply.code(404).send()
    return reply.code(500).send({ error: error.message })
  })
  return { app, database }
}

beforeEach(() => {
  vi.mocked(findSchoolMembership).mockReset().mockResolvedValue(null)
  vi.mocked(hasActiveVerifiedGuardianRelationship)
    .mockReset()
    .mockResolvedValue(false)
  vi.mocked(requestFamilyMeeting)
    .mockReset()
    .mockResolvedValue({ id: requestId } as never)
  vi.mocked(scheduleFamilyMeeting)
    .mockReset()
    .mockResolvedValue({ id: requestId } as never)
})

describe('family meeting API authorization', () => {
  it('requires login and a verified linked child before listing teachers', async () => {
    const { app } = fixture()
    try {
      const url = `/parent/schools/${schoolId}/children/${studentId}/meeting-teachers`
      expect((await app.inject(url)).statusCode).toBe(401)
      expect(
        (await app.inject({ url, headers: { 'x-user': actorId } })).statusCode,
      ).toBe(404)
      vi.mocked(hasActiveVerifiedGuardianRelationship).mockResolvedValue(true)
      expect(
        (await app.inject({ url, headers: { 'x-user': actorId } })).statusCode,
      ).toBe(200)
      expect(hasActiveVerifiedGuardianRelationship).toHaveBeenCalledWith(
        expect.anything(),
        schoolId,
        studentId,
        guardianId,
      )
    } finally {
      await app.close()
    }
  })

  it('derives guardian identity from login and rejects client identity spoofing', async () => {
    const { app } = fixture()
    try {
      const url = `/parent/schools/${schoolId}/meetings`
      const body = {
        studentId,
        teachingAssignmentId: assignmentId,
        topic: 'Discuss coursework',
      }
      const created = await app.inject({
        method: 'POST',
        url,
        headers: { 'x-user': actorId },
        payload: body,
      })
      expect(created.statusCode).toBe(201)
      expect(requestFamilyMeeting).toHaveBeenCalledWith(
        expect.anything(),
        actorId,
        { schoolId, ...body },
      )
      const spoof = await app.inject({
        method: 'POST',
        url,
        headers: { 'x-user': actorId },
        payload: { ...body, guardianUserId: studentId },
      })
      expect(spoof.statusCode).toBe(400)
    } finally {
      await app.close()
    }
  })

  it('limits teacher meeting list and schedule calls to the signed-in staff identity', async () => {
    const { app, database } = fixture()
    try {
      const url = `/schools/${schoolId}/meetings`
      expect(
        (await app.inject({ url, headers: { 'x-user': actorId } })).statusCode,
      ).toBe(404)
      vi.mocked(findSchoolMembership).mockResolvedValue({
        role: 'teacher',
      } as never)
      expect(
        (await app.inject({ url, headers: { 'x-user': actorId } })).statusCode,
      ).toBe(200)
      expect(
        database.parentTeacherMeetingRequest.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ where: { schoolId, teacherId: actorId } }),
      )
      const scheduled = await app.inject({
        method: 'POST',
        url: `${url}/${requestId}/schedule`,
        headers: { 'x-user': actorId },
        payload: { availabilityId: assignmentId },
      })
      expect(scheduled.statusCode).toBe(200)
      expect(scheduleFamilyMeeting).toHaveBeenCalledWith(
        expect.anything(),
        actorId,
        { schoolId, requestId, availabilityId: assignmentId },
      )
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `${url}/${requestId}`,
            headers: { 'x-user': actorId },
            payload: { status: 'completed' },
          })
        ).statusCode,
      ).toBe(404)
    } finally {
      await app.close()
    }
  })
})
