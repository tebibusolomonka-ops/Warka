import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  cancelFamilyMeeting,
  closeMeetingAvailability,
  completeFamilyMeeting,
  createMeetingAvailability,
  declineFamilyMeeting,
  findSchoolMembership,
  hasActiveVerifiedGuardianRelationship,
  listMeetingHistory,
  MeetingAvailabilitySchema,
  MeetingRequestSchema,
  requestFamilyMeeting,
  requireMeetingTeacher,
  ScheduleFamilyMeetingSchema,
  scheduleFamilyMeeting,
  type PrismaClient,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'

const school = z.strictObject({ schoolId: z.uuid() })
const request = school.extend({ requestId: z.uuid() })
const availability = school.extend({ availabilityId: z.uuid() })
const child = school.extend({ studentId: z.uuid() })
const pageQuery = z.strictObject({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
const reason = z.strictObject({ reason: z.string().trim().min(3).max(300) })
const slotBody = z.strictObject({
  startsAt: MeetingAvailabilitySchema.shape.startsAt,
  endsAt: MeetingAvailabilitySchema.shape.endsAt,
  method: MeetingAvailabilitySchema.shape.method,
})
const scheduleBody = ScheduleFamilyMeetingSchema.omit({
  schoolId: true,
  requestId: true,
})
const requestBody = MeetingRequestSchema.omit({ schoolId: true })

export class FamilyMeetingRouteAccessError extends Error {}

export function registerFamilyMeetingRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  const actor = (value: Parameters<typeof authenticatedUser>[0]) =>
    authenticatedUser(value).id
  async function guardianChild(
    actorId: string,
    schoolId: string,
    studentId: string,
  ) {
    const access = await getDatabase().guardianAccess.findUnique({
      where: { userId: actorId },
    })
    if (
      !access ||
      !(await hasActiveVerifiedGuardianRelationship(
        getDatabase(),
        schoolId,
        studentId,
        access.guardianId,
      ))
    )
      throw new FamilyMeetingRouteAccessError('Child not found')
    return access.guardianId
  }
  async function staff(actorId: string, schoolId: string) {
    const membership = await findSchoolMembership(
      getDatabase(),
      actorId,
      schoolId,
    )
    if (membership?.role !== 'administrator' && membership?.role !== 'teacher')
      throw new FamilyMeetingRouteAccessError('School meetings unavailable')
    return membership.role
  }

  app.get(
    '/parent/schools/:schoolId/children/:studentId/meeting-teachers',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, studentId } = child.parse(http.params)
      await guardianChild(actor(http), schoolId, studentId)
      const enrollment = await getDatabase().enrollment.findFirst({
        where: {
          schoolId,
          studentId,
          status: 'approved',
          withdrawnAt: null,
          schoolClassId: { not: null },
        },
        orderBy: { approvedAt: 'desc' },
      })
      if (!enrollment?.schoolClassId) return { teachers: [] }
      const now = new Date()
      const rows = await getDatabase().teachingAssignment.findMany({
        where: {
          schoolId,
          academicYearId: enrollment.academicYearId,
          schoolClassId: enrollment.schoolClassId,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          user: {
            schoolMemberships: {
              some: {
                schoolId,
                role: 'teacher',
                startsAt: { lte: now },
                OR: [{ endsAt: null }, { endsAt: { gt: now } }],
              },
            },
          },
        },
        select: {
          id: true,
          userId: true,
          user: { select: { displayName: true } },
          subject: { select: { name: true } },
        },
        orderBy: { id: 'asc' },
      })
      return {
        teachers: rows.map((row) => ({
          assignmentId: row.id,
          teacherId: row.userId,
          teacherName: row.user.displayName,
          subjectName: row.subject.name,
        })),
      }
    },
  )

  app.get(
    '/parent/schools/:schoolId/children/:studentId/meeting-teachers/:teacherId/availability',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, studentId, teacherId } = child
        .extend({ teacherId: z.uuid() })
        .parse(http.params)
      await guardianChild(actor(http), schoolId, studentId)
      const teachers = await getDatabase().teachingAssignment.findFirst({
        where: {
          schoolId,
          userId: teacherId,
          schoolClass: {
            enrollments: {
              some: {
                studentId,
                schoolId,
                status: 'approved',
                withdrawnAt: null,
              },
            },
          },
          startsAt: { lte: new Date() },
          OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
        },
        select: { id: true },
      })
      if (!teachers)
        throw new FamilyMeetingRouteAccessError('Teacher unavailable')
      const slots = await getDatabase().teacherMeetingAvailability.findMany({
        where: {
          schoolId,
          teacherId,
          active: true,
          startsAt: { gt: new Date() },
        },
        select: { id: true, startsAt: true, endsAt: true, method: true },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        take: 50,
      })
      return { slots }
    },
  )

  app.post(
    '/parent/schools/:schoolId/meetings',
    { preHandler: authenticate },
    async (http, reply) => {
      const { schoolId } = school.parse(http.params)
      const body = requestBody.parse(http.body)
      const created = await requestFamilyMeeting(getDatabase(), actor(http), {
        schoolId,
        ...body,
      })
      return reply.code(201).send(created)
    },
  )

  app.get(
    '/parent/schools/:schoolId/meetings',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId } = school.parse(http.params)
      const { cursor, limit } = pageQuery.parse(http.query)
      const access = await getDatabase().guardianAccess.findUnique({
        where: { userId: actor(http) },
      })
      if (!access)
        throw new FamilyMeetingRouteAccessError('Guardian access required')
      const rows = await getDatabase().parentTeacherMeetingRequest.findMany({
        where: {
          schoolId,
          guardianUserId: actor(http),
          guardianId: access.guardianId,
          student: {
            guardians: {
              some: {
                guardianId: access.guardianId,
                verificationStatus: 'verified',
                verificationSchoolId: schoolId,
                revokedAt: null,
              },
            },
          },
        },
        select: {
          id: true,
          studentId: true,
          teacherId: true,
          topic: true,
          status: true,
          scheduledStartAt: true,
          scheduledEndAt: true,
          meetingMethod: true,
          schoolLocation: true,
          createdAt: true,
        },
        orderBy: { id: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      return {
        meetings: rows.slice(0, limit),
        nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
      }
    },
  )

  app.post(
    '/parent/schools/:schoolId/meetings/:requestId/cancel',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, requestId } = request.parse(http.params)
      const body = z
        .strictObject({ reason: reason.shape.reason.optional() })
        .parse(http.body ?? {})
      return cancelFamilyMeeting(
        getDatabase(),
        actor(http),
        schoolId,
        requestId,
        body.reason,
      )
    },
  )

  app.get(
    '/schools/:schoolId/meetings/availability',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId } = school.parse(http.params)
      await requireMeetingTeacher(getDatabase(), actor(http), schoolId)
      return {
        slots: await getDatabase().teacherMeetingAvailability.findMany({
          where: { schoolId, teacherId: actor(http), active: true },
          select: { id: true, startsAt: true, endsAt: true, method: true },
          orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
          take: 100,
        }),
      }
    },
  )
  app.post(
    '/schools/:schoolId/meetings/availability',
    { preHandler: authenticate },
    async (http, reply) => {
      const { schoolId } = school.parse(http.params)
      const created = await createMeetingAvailability(
        getDatabase(),
        actor(http),
        { schoolId, ...slotBody.parse(http.body) },
      )
      return reply.code(201).send(created)
    },
  )
  app.post(
    '/schools/:schoolId/meetings/availability/:availabilityId/close',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, availabilityId } = availability.parse(http.params)
      await closeMeetingAvailability(
        getDatabase(),
        actor(http),
        schoolId,
        availabilityId,
      )
      return { closed: true }
    },
  )

  app.get(
    '/schools/:schoolId/meetings',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId } = school.parse(http.params)
      const { cursor, limit } = pageQuery.parse(http.query)
      const role = await staff(actor(http), schoolId)
      const rows = await getDatabase().parentTeacherMeetingRequest.findMany({
        where: {
          schoolId,
          ...(role === 'teacher' ? { teacherId: actor(http) } : {}),
        },
        select: {
          id: true,
          studentId: true,
          teacherId: true,
          topic: true,
          status: true,
          scheduledStartAt: true,
          scheduledEndAt: true,
          meetingMethod: true,
          schoolLocation: true,
          createdAt: true,
          student: { select: { givenName: true, familyName: true } },
        },
        orderBy: { id: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      return {
        meetings: rows.slice(0, limit),
        nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
      }
    },
  )

  app.get(
    '/schools/:schoolId/meetings/:requestId/history',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, requestId } = request.parse(http.params)
      return {
        events: await listMeetingHistory(
          getDatabase(),
          actor(http),
          schoolId,
          requestId,
        ),
      }
    },
  )
  app.get(
    '/parent/schools/:schoolId/meetings/:requestId/history',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, requestId } = request.parse(http.params)
      return {
        events: await listMeetingHistory(
          getDatabase(),
          actor(http),
          schoolId,
          requestId,
        ),
      }
    },
  )
  app.post(
    '/schools/:schoolId/meetings/:requestId/schedule',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, requestId } = request.parse(http.params)
      return scheduleFamilyMeeting(getDatabase(), actor(http), {
        schoolId,
        requestId,
        ...scheduleBody.parse(http.body),
      })
    },
  )
  app.post(
    '/schools/:schoolId/meetings/:requestId/decline',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, requestId } = request.parse(http.params)
      return declineFamilyMeeting(
        getDatabase(),
        actor(http),
        schoolId,
        requestId,
        reason.parse(http.body).reason,
      )
    },
  )
  app.post(
    '/schools/:schoolId/meetings/:requestId/cancel',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, requestId } = request.parse(http.params)
      return cancelFamilyMeeting(
        getDatabase(),
        actor(http),
        schoolId,
        requestId,
        reason.parse(http.body).reason,
      )
    },
  )
  app.post(
    '/schools/:schoolId/meetings/:requestId/complete',
    { preHandler: authenticate },
    async (http) => {
      const { schoolId, requestId } = request.parse(http.params)
      return completeFamilyMeeting(
        getDatabase(),
        actor(http),
        schoolId,
        requestId,
      )
    },
  )
}
