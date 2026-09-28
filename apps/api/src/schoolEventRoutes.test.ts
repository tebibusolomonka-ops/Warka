import Fastify from 'fastify'
import type { PrismaClient, User } from '@warka/database'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import {
  createSchoolEvent,
  hasActiveVerifiedGuardianRelationship,
  mayViewSchoolEvent,
  requireSchoolEventManager,
  respondToSchoolEvent,
} from '@warka/database'
import {
  registerSchoolEventRoutes,
  SchoolEventRouteAccessError,
} from './schoolEventRoutes.js'

vi.mock('@warka/database', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@warka/database')>()),
  createSchoolEvent: vi.fn(),
  hasActiveVerifiedGuardianRelationship: vi.fn(),
  mayViewSchoolEvent: vi.fn(),
  requireSchoolEventManager: vi.fn(),
  respondToSchoolEvent: vi.fn(),
}))

const schoolId = '11111111-1111-4111-8111-111111111111'
const studentId = '22222222-2222-4222-8222-222222222222'
const eventId = '33333333-3333-4333-8333-333333333333'
const actorId = '44444444-4444-4444-8444-444444444444'

function fixture() {
  const database = {
    guardianAccess: {
      findUnique: vi.fn().mockResolvedValue({ guardianId: actorId }),
    },
    studentAccess: { findUnique: vi.fn().mockResolvedValue({ studentId }) },
    schoolEvent: {
      findFirst: vi.fn().mockResolvedValue({ id: eventId, schoolId }),
      findMany: vi.fn().mockResolvedValue([{ id: eventId }]),
      findFirstOrThrow: vi
        .fn()
        .mockResolvedValue({ id: eventId, schoolId, attachments: [] }),
    },
  } as unknown as PrismaClient
  const app = Fastify()
  app.decorateRequest('currentUser', null)
  registerSchoolEventRoutes(
    app,
    () => database,
    async (http, reply) => {
      if (!http.headers['x-user']) return reply.code(401).send()
      http.currentUser = { id: String(http.headers['x-user']) } as User
    },
  )
  app.setErrorHandler((error, _http, reply) => {
    if (error instanceof ZodError) return reply.code(400).send()
    if (error instanceof SchoolEventRouteAccessError)
      return reply.code(404).send()
    return reply.code(500).send({ error: error.message })
  })
  return { app, database }
}

beforeEach(() => {
  vi.mocked(hasActiveVerifiedGuardianRelationship)
    .mockReset()
    .mockResolvedValue(false)
  vi.mocked(mayViewSchoolEvent).mockReset().mockResolvedValue(false)
  vi.mocked(createSchoolEvent)
    .mockReset()
    .mockResolvedValue({ id: eventId } as never)
  vi.mocked(requireSchoolEventManager).mockReset().mockResolvedValue(undefined)
  vi.mocked(respondToSchoolEvent)
    .mockReset()
    .mockResolvedValue({ status: 'going' } as never)
})

describe('school event API boundaries', () => {
  it('requires login and linked child before guardian listing', async () => {
    const { app } = fixture()
    try {
      const url = `/parent/schools/${schoolId}/children/${studentId}/events`
      expect((await app.inject(url)).statusCode).toBe(401)
      expect(
        (await app.inject({ url, headers: { 'x-user': actorId } })).statusCode,
      ).toBe(404)
      vi.mocked(hasActiveVerifiedGuardianRelationship).mockResolvedValue(true)
      expect(
        (await app.inject({ url, headers: { 'x-user': actorId } })).statusCode,
      ).toBe(200)
    } finally {
      await app.close()
    }
  })

  it('filters published events through audience authorization', async () => {
    const { app } = fixture()
    try {
      const url = `/student/schools/${schoolId}/events`
      const headers = { 'x-user': actorId }
      expect((await app.inject({ url, headers })).json()).toEqual({
        events: [],
      })
      vi.mocked(mayViewSchoolEvent).mockResolvedValue(true)
      expect((await app.inject({ url, headers })).json().events).toHaveLength(1)
      expect(mayViewSchoolEvent).toHaveBeenCalledWith(
        expect.anything(),
        actorId,
        schoolId,
        eventId,
        undefined,
      )
    } finally {
      await app.close()
    }
  })

  it('derives creator and RSVP respondent from authentication', async () => {
    const { app } = fixture()
    try {
      const headers = { 'x-user': actorId }
      const payload = {
        title: 'Open day',
        description: 'Welcome families',
        startsAt: '2026-10-01T09:00:00Z',
        endsAt: '2026-10-01T10:00:00Z',
      }
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/schools/${schoolId}/events`,
            headers,
            payload,
          })
        ).statusCode,
      ).toBe(201)
      expect(createSchoolEvent).toHaveBeenCalledWith(
        expect.anything(),
        actorId,
        { schoolId, ...payload },
      )
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/schools/${schoolId}/events`,
            headers,
            payload: { ...payload, createdById: studentId },
          })
        ).statusCode,
      ).toBe(400)
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/student/schools/${schoolId}/events/${eventId}/responses`,
            headers,
            payload: { status: 'going' },
          })
        ).statusCode,
      ).toBe(200)
      expect(respondToSchoolEvent).toHaveBeenCalledWith(
        expect.anything(),
        actorId,
        schoolId,
        eventId,
        'going',
      )
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/student/schools/${schoolId}/events/${eventId}/responses`,
            headers,
            payload: { status: 'going', studentId },
          })
        ).statusCode,
      ).toBe(400)
    } finally {
      await app.close()
    }
  })

  it('does not offer a generic event status patch', async () => {
    const { app } = fixture()
    try {
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: `/schools/${schoolId}/events/${eventId}`,
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
