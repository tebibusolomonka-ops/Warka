import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  AssessmentParticipationInputSchema,
  AssessmentRoomInputSchema,
  AssessmentScheduleInputSchema,
  MakeUpRequestSchema,
  MakeUpScheduleSchema,
  assignAssessmentInvigilator,
  completeAssessmentSession,
  createAssessmentRoom,
  createAssessmentSchedule,
  createAssessmentSession,
  listAssessmentRooms,
  mayManageAttendance,
  openAssessmentSession,
  recordAssessmentParticipation,
  requestMakeUpAssessment,
  requireAcademicYearAdmin,
  reviewMakeUpAssessment,
  scheduleAssessment,
  scheduleMakeUpAssessment,
  setAssessmentRoomActive,
  validateAssessmentSchedule,
  type PrismaClient,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'

const school = z.strictObject({ schoolId: z.uuid() })
const scheduleParams = school.extend({ scheduleId: z.uuid() })
const sessionParams = school.extend({ sessionId: z.uuid() })
const roomParams = school.extend({ roomId: z.uuid() })
const makeUpParams = school.extend({ makeUpId: z.uuid() })
const roomBody = AssessmentRoomInputSchema.omit({ schoolId: true })
const scheduleBody = z
  .strictObject(AssessmentScheduleInputSchema.shape)
  .omit({ schoolId: true })
const participationBody = AssessmentParticipationInputSchema.omit({
  schoolId: true,
  sessionId: true,
})
const makeUpBody = MakeUpRequestSchema.omit({ schoolId: true })
const calendarQuery = z.strictObject({
  academicYearId: z.uuid(),
  schoolClassId: z.uuid().optional(),
  subjectId: z.uuid().optional(),
})

export function registerAssessmentScheduleRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  const actor = (request: Parameters<typeof authenticatedUser>[0]) =>
    authenticatedUser(request).id
  const admin = (actorId: string, schoolId: string) =>
    requireAcademicYearAdmin(getDatabase(), actorId, schoolId)

  async function scopedSchedule(schoolId: string, scheduleId: string) {
    return getDatabase().assessmentSchedule.findFirst({
      where: { id: scheduleId, schoolId },
    })
  }

  async function sessionStaff(
    actorId: string,
    schoolId: string,
    sessionId: string,
  ) {
    const session = await getDatabase().assessmentSession.findFirst({
      where: { id: sessionId, schoolId },
      include: {
        schedule: { select: { academicYearId: true, subjectId: true } },
      },
    })
    if (!session) return null
    const membership = await getDatabase().schoolMembership.findUnique({
      where: { userId_schoolId: { userId: actorId, schoolId } },
    })
    const now = new Date()
    if (
      !membership ||
      membership.startsAt > now ||
      (membership.endsAt && membership.endsAt <= now)
    )
      return null
    if (membership.role === 'administrator') return session
    if (
      await mayManageAttendance(
        getDatabase(),
        actorId,
        {
          schoolId,
          academicYearId: session.schedule.academicYearId,
          schoolClassId: session.schoolClassId,
          subjectId: session.schedule.subjectId,
        },
        now,
      )
    )
      return session
    const invigilation = await getDatabase().assessmentInvigilation.findFirst({
      where: { schoolId, sessionId, userId: actorId },
      select: { id: true },
    })
    return invigilation ? session : null
  }

  app.get(
    '/schools/:schoolId/assessment-rooms',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = school.parse(request.params)
      await admin(actor(request), schoolId)
      return { rooms: await listAssessmentRooms(getDatabase(), schoolId) }
    },
  )
  app.post(
    '/schools/:schoolId/assessment-rooms',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      await admin(actor(request), schoolId)
      return reply.code(201).send(
        await createAssessmentRoom(getDatabase(), {
          schoolId,
          ...roomBody.parse(request.body),
        }),
      )
    },
  )
  app.post(
    '/schools/:schoolId/assessment-rooms/:roomId/active',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, roomId } = roomParams.parse(request.params)
      await admin(actor(request), schoolId)
      const { active } = z
        .strictObject({ active: z.boolean() })
        .parse(request.body)
      return setAssessmentRoomActive(getDatabase(), schoolId, roomId, active)
    },
  )
  app.post(
    '/schools/:schoolId/assessment-schedules',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      await admin(actor(request), schoolId)
      return reply.code(201).send(
        await createAssessmentSchedule(getDatabase(), {
          schoolId,
          ...scheduleBody.parse(request.body),
        }),
      )
    },
  )
  app.get(
    '/schools/:schoolId/assessment-schedules',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = school.parse(request.params)
      await admin(actor(request), schoolId)
      const { academicYearId } = z
        .strictObject({ academicYearId: z.uuid().optional() })
        .parse(request.query)
      return {
        schedules: await getDatabase().assessmentSchedule.findMany({
          where: { schoolId, ...(academicYearId ? { academicYearId } : {}) },
          include: {
            assessment: { select: { name: true } },
            room: { select: { name: true, capacity: true } },
            sessions: { select: { id: true, status: true } },
          },
          orderBy: [{ scheduledDate: 'asc' }, { startTime: 'asc' }],
        }),
      }
    },
  )
  app.patch(
    '/schools/:schoolId/assessment-schedules/:scheduleId',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, scheduleId } = scheduleParams.parse(request.params)
      await admin(actor(request), schoolId)
      const current = await scopedSchedule(schoolId, scheduleId)
      if (!current || current.status !== 'draft')
        return reply.code(409).send({ error: { code: 'ASSESSMENT_STATE' } })
      const patch = scheduleBody.partial().parse(request.body)
      const full = AssessmentScheduleInputSchema.parse({
        schoolId,
        academicYearId: patch.academicYearId ?? current.academicYearId,
        gradingPeriodId: patch.gradingPeriodId ?? current.gradingPeriodId,
        schoolClassId: patch.schoolClassId ?? current.schoolClassId,
        subjectId: patch.subjectId ?? current.subjectId,
        assessmentId: patch.assessmentId ?? current.assessmentId,
        roomId: patch.roomId ?? current.roomId ?? undefined,
        scheduledDate:
          patch.scheduledDate ??
          current.scheduledDate.toISOString().slice(0, 10),
        startTime: patch.startTime ?? current.startTime,
        endTime: patch.endTime ?? current.endTime,
      })
      const updated = await getDatabase().assessmentSchedule.updateMany({
        where: { id: scheduleId, schoolId, status: 'draft' },
        data: {
          ...full,
          roomId: full.roomId ?? null,
          scheduledDate: new Date(`${full.scheduledDate}T00:00:00.000Z`),
        },
      })
      if (updated.count !== 1)
        return reply.code(409).send({ error: { code: 'ASSESSMENT_STATE' } })
      return getDatabase().assessmentSchedule.findUniqueOrThrow({
        where: { id: scheduleId },
      })
    },
  )
  app.get(
    '/schools/:schoolId/assessment-schedules/:scheduleId/validation',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, scheduleId } = scheduleParams.parse(request.params)
      await admin(actor(request), schoolId)
      const schedule = await scopedSchedule(schoolId, scheduleId)
      if (!schedule) return reply.code(404).send()
      const issues = await validateAssessmentSchedule(getDatabase(), schedule)
      return { valid: issues.length === 0, issues }
    },
  )
  app.post(
    '/schools/:schoolId/assessment-schedules/:scheduleId/schedule',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, scheduleId } = scheduleParams.parse(request.params)
      await admin(actor(request), schoolId)
      return scheduleAssessment(getDatabase(), schoolId, scheduleId)
    },
  )
  app.post(
    '/schools/:schoolId/assessment-schedules/:scheduleId/cancel',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, scheduleId } = scheduleParams.parse(request.params)
      await admin(actor(request), schoolId)
      const updated = await getDatabase().assessmentSchedule.updateMany({
        where: {
          id: scheduleId,
          schoolId,
          status: { in: ['draft', 'scheduled'] },
          sessions: { none: { status: { in: ['open', 'completed'] } } },
        },
        data: { status: 'cancelled' },
      })
      return reply
        .code(updated.count ? 200 : 409)
        .send({ cancelled: updated.count === 1 })
    },
  )
  app.post(
    '/schools/:schoolId/assessment-schedules/:scheduleId/session',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, scheduleId } = scheduleParams.parse(request.params)
      await admin(actor(request), schoolId)
      return reply
        .code(201)
        .send(
          await createAssessmentSession(getDatabase(), schoolId, scheduleId),
        )
    },
  )
  app.post(
    '/schools/:schoolId/assessment-sessions/:sessionId/open',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, sessionId } = sessionParams.parse(request.params)
      if (!(await sessionStaff(actor(request), schoolId, sessionId)))
        return reply.code(403).send()
      return openAssessmentSession(getDatabase(), schoolId, sessionId)
    },
  )
  app.get(
    '/schools/:schoolId/assessment-sessions/:sessionId',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, sessionId } = sessionParams.parse(request.params)
      if (!(await sessionStaff(actor(request), schoolId, sessionId)))
        return reply.code(403).send()
      return getDatabase().assessmentSession.findFirst({
        where: { id: sessionId, schoolId },
        include: {
          participations: { select: { studentId: true, status: true } },
          invigilations: { select: { userId: true } },
        },
      })
    },
  )
  app.post(
    '/schools/:schoolId/assessment-sessions/:sessionId/participation',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, sessionId } = sessionParams.parse(request.params)
      if (!(await sessionStaff(actor(request), schoolId, sessionId)))
        return reply.code(403).send()
      return reply.code(201).send(
        await recordAssessmentParticipation(getDatabase(), actor(request), {
          schoolId,
          sessionId,
          ...participationBody.parse(request.body),
        }),
      )
    },
  )
  app.post(
    '/schools/:schoolId/assessment-sessions/:sessionId/complete',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, sessionId } = sessionParams.parse(request.params)
      if (!(await sessionStaff(actor(request), schoolId, sessionId)))
        return reply.code(403).send()
      return completeAssessmentSession(getDatabase(), schoolId, sessionId)
    },
  )
  app.post(
    '/schools/:schoolId/make-up-assessments',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      await admin(actor(request), schoolId)
      return reply.code(201).send(
        await requestMakeUpAssessment(getDatabase(), actor(request), {
          schoolId,
          ...makeUpBody.parse(request.body),
        }),
      )
    },
  )
  app.get(
    '/schools/:schoolId/make-up-assessments',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = school.parse(request.params)
      await admin(actor(request), schoolId)
      return {
        requests: await getDatabase().makeUpAssessment.findMany({
          where: { schoolId },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
      }
    },
  )
  app.post(
    '/schools/:schoolId/make-up-assessments/:makeUpId/review',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, makeUpId } = makeUpParams.parse(request.params)
      await admin(actor(request), schoolId)
      const { decision } = z
        .strictObject({ decision: z.enum(['approved', 'rejected']) })
        .parse(request.body)
      return reviewMakeUpAssessment(
        getDatabase(),
        schoolId,
        makeUpId,
        actor(request),
        decision,
      )
    },
  )
  app.post(
    '/schools/:schoolId/make-up-assessments/:makeUpId/schedule',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, makeUpId } = makeUpParams.parse(request.params)
      await admin(actor(request), schoolId)
      return scheduleMakeUpAssessment(
        getDatabase(),
        schoolId,
        makeUpId,
        MakeUpScheduleSchema.parse(request.body),
      )
    },
  )
  app.post(
    '/schools/:schoolId/assessment-sessions/:sessionId/invigilators',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, sessionId } = sessionParams.parse(request.params)
      await admin(actor(request), schoolId)
      const { userId } = z
        .strictObject({ userId: z.uuid() })
        .parse(request.body)
      return reply
        .code(201)
        .send(
          await assignAssessmentInvigilator(
            getDatabase(),
            schoolId,
            sessionId,
            userId,
            actor(request),
          ),
        )
    },
  )
  app.get(
    '/schools/:schoolId/assessment-calendar',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      const { academicYearId, schoolClassId, subjectId } = calendarQuery.parse(
        request.query,
      )
      const userId = actor(request)
      const membership = await getDatabase().schoolMembership.findUnique({
        where: { userId_schoolId: { userId, schoolId } },
      })
      const now = new Date()
      if (
        !membership ||
        membership.startsAt > now ||
        (membership.endsAt && membership.endsAt <= now)
      )
        return reply.code(403).send()
      if (membership.role !== 'administrator') {
        if (
          !schoolClassId ||
          !subjectId ||
          !(await mayManageAttendance(
            getDatabase(),
            userId,
            { schoolId, academicYearId, schoolClassId, subjectId },
            now,
          ))
        )
          return reply.code(403).send()
      }
      return {
        schedules: await getDatabase().assessmentSchedule.findMany({
          where: {
            schoolId,
            academicYearId,
            ...(schoolClassId ? { schoolClassId } : {}),
            ...(subjectId ? { subjectId } : {}),
            status: { in: ['scheduled', 'completed'] },
          },
          orderBy: [{ scheduledDate: 'asc' }, { startTime: 'asc' }],
          include: {
            assessment: { select: { name: true } },
            room: { select: { name: true } },
          },
        }),
      }
    },
  )
  app.get(
    '/schools/:schoolId/my-assessment-calendar',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      const userId = actor(request)
      const membership = await getDatabase().schoolMembership.findUnique({
        where: { userId_schoolId: { userId, schoolId } },
      })
      const now = new Date()
      if (
        !membership ||
        membership.startsAt > now ||
        (membership.endsAt && membership.endsAt <= now)
      )
        return reply.code(403).send()
      const assignments = await getDatabase().teachingAssignment.findMany({
        where: {
          schoolId,
          userId,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
        select: { schoolClassId: true, subjectId: true },
      })
      return {
        sessions: await getDatabase().assessmentSession.findMany({
          where: {
            schoolId,
            status: { in: ['planned', 'open', 'completed'] },
            OR: [
              { invigilations: { some: { userId } } },
              ...assignments.map(({ schoolClassId, subjectId }) => ({
                schedule: {
                  schoolClassId,
                  subjectId,
                },
              })),
            ],
          },
          include: {
            schedule: { include: { assessment: { select: { name: true } } } },
          },
          orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }],
        }),
      }
    },
  )
}
