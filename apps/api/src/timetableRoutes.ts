import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  archiveClassTimetable,
  ClassTimetableStateError,
  ClassTimetableEntryError,
  ClassTimetableEntryInputSchema,
  createClassTimetableDraft,
  createClassTimetableEntry,
  createSchoolCalendarDay,
  createTimetablePeriod,
  effectiveMembershipWhere,
  listClassTimetables,
  listSchoolCalendarDays,
  listTimetablePeriods,
  publishClassTimetable,
  requireAcademicYearAdmin,
  SchoolCalendarDayInputSchema,
  TimetablePeriodInputSchema,
  validateClassTimetableEntry,
  validateSchoolTimetable,
  type PrismaClient,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'

const school = z.strictObject({ schoolId: z.uuid() })
const planParams = school.extend({ planId: z.uuid() })
const entryParams = planParams.extend({ entryId: z.uuid() })
const idParams = school.extend({ id: z.uuid() })
const classParams = school.extend({ schoolClassId: z.uuid() })
const yearQuery = z.strictObject({ academicYearId: z.uuid() })
const classQuery = yearQuery.extend({ schoolClassId: z.uuid() })
const entryBody = ClassTimetableEntryInputSchema.omit({
  timetableId: true,
  schoolId: true,
  academicYearId: true,
  schoolClassId: true,
})

export function registerTimetableRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  const admin = (actorId: string, schoolId: string) =>
    requireAcademicYearAdmin(getDatabase(), actorId, schoolId)
  async function scopedPlan(schoolId: string, planId: string) {
    const plan = await getDatabase().classTimetable.findFirst({
      where: { id: planId, schoolId },
    })
    if (!plan) throw new ClassTimetableStateError('Timetable not found')
    return plan
  }
  async function activeTeacher(actorId: string, schoolId: string) {
    return getDatabase().schoolMembership.findFirst({
      where: {
        userId: actorId,
        schoolId,
        role: 'teacher',
        ...effectiveMembershipWhere(),
      },
      select: { userId: true },
    })
  }

  app.get(
    '/schools/:schoolId/timetable/calendar-days',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = school.parse(request.params)
      const { academicYearId } = yearQuery.parse(request.query)
      await admin(authenticatedUser(request).id, schoolId)
      return {
        days: await listSchoolCalendarDays(
          getDatabase(),
          schoolId,
          academicYearId,
        ),
      }
    },
  )
  app.post(
    '/schools/:schoolId/timetable/calendar-days',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      await admin(authenticatedUser(request).id, schoolId)
      const body = SchoolCalendarDayInputSchema.omit({ schoolId: true }).parse(
        request.body,
      )
      return reply
        .code(201)
        .send(
          await createSchoolCalendarDay(getDatabase(), { schoolId, ...body }),
        )
    },
  )
  app.delete(
    '/schools/:schoolId/timetable/calendar-days/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, id } = idParams.parse(request.params)
      await admin(authenticatedUser(request).id, schoolId)
      const deleted = await getDatabase().schoolCalendarDay.deleteMany({
        where: { id, schoolId },
      })
      return reply.code(deleted.count ? 204 : 404).send()
    },
  )

  app.get(
    '/schools/:schoolId/timetable/periods',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = school.parse(request.params)
      await admin(authenticatedUser(request).id, schoolId)
      return { periods: await listTimetablePeriods(getDatabase(), schoolId) }
    },
  )
  app.post(
    '/schools/:schoolId/timetable/periods',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      await admin(authenticatedUser(request).id, schoolId)
      const body = TimetablePeriodInputSchema.omit({ schoolId: true }).parse(
        request.body,
      )
      return reply
        .code(201)
        .send(await createTimetablePeriod(getDatabase(), { schoolId, ...body }))
    },
  )
  app.delete(
    '/schools/:schoolId/timetable/periods/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, id } = idParams.parse(request.params)
      await admin(authenticatedUser(request).id, schoolId)
      const deleted = await getDatabase().timetablePeriod.deleteMany({
        where: { id, schoolId },
      })
      return reply.code(deleted.count ? 204 : 404).send()
    },
  )

  app.get(
    '/schools/:schoolId/timetables',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = school.parse(request.params)
      const { academicYearId, schoolClassId } = classQuery.parse(request.query)
      await admin(authenticatedUser(request).id, schoolId)
      return {
        timetables: await listClassTimetables(
          getDatabase(),
          schoolId,
          academicYearId,
          schoolClassId,
        ),
      }
    },
  )
  app.post(
    '/schools/:schoolId/timetables',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      await admin(authenticatedUser(request).id, schoolId)
      const body = classQuery.parse(request.body)
      return reply
        .code(201)
        .send(
          await createClassTimetableDraft(getDatabase(), { schoolId, ...body }),
        )
    },
  )
  app.get(
    '/schools/:schoolId/timetables/:planId',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, planId } = planParams.parse(request.params)
      await admin(authenticatedUser(request).id, schoolId)
      const plan = await scopedPlan(schoolId, planId)
      const entries = await getDatabase().classTimetableEntry.findMany({
        where: { timetableId: planId },
        include: {
          subject: true,
          timetablePeriod: true,
          teachingAssignment: { select: { userId: true } },
        },
        orderBy: [
          { weekday: 'asc' },
          { timetablePeriod: { sortOrder: 'asc' } },
        ],
      })
      return { plan, entries }
    },
  )
  app.post(
    '/schools/:schoolId/timetables/:planId/entries',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, planId } = planParams.parse(request.params)
      await admin(authenticatedUser(request).id, schoolId)
      const plan = await scopedPlan(schoolId, planId)
      const body = entryBody.parse(request.body)
      return reply.code(201).send(
        await createClassTimetableEntry(getDatabase(), {
          timetableId: planId,
          schoolId,
          academicYearId: plan.academicYearId,
          schoolClassId: plan.schoolClassId,
          ...body,
        }),
      )
    },
  )
  app.put(
    '/schools/:schoolId/timetables/:planId/entries/:entryId',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, planId, entryId } = entryParams.parse(request.params)
      await admin(authenticatedUser(request).id, schoolId)
      const plan = await scopedPlan(schoolId, planId)
      if (plan.status !== 'draft')
        throw new ClassTimetableStateError('Draft timetable required')
      const body = entryBody.parse(request.body)
      const existing = await getDatabase().classTimetableEntry.findFirst({
        where: { id: entryId, timetableId: planId },
      })
      if (!existing) throw new ClassTimetableStateError('Entry not found')
      const problems = await validateClassTimetableEntry(
        getDatabase(),
        {
          timetableId: planId,
          schoolId,
          academicYearId: plan.academicYearId,
          schoolClassId: plan.schoolClassId,
          ...body,
        },
        new Date(),
        entryId,
      )
      if (problems.length)
        throw new ClassTimetableEntryError(
          problems.map((problem) => problem.code).join(', '),
        )
      return getDatabase().classTimetableEntry.update({
        where: { id: entryId },
        data: body,
      })
    },
  )
  app.delete(
    '/schools/:schoolId/timetables/:planId/entries/:entryId',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, planId, entryId } = entryParams.parse(request.params)
      await admin(authenticatedUser(request).id, schoolId)
      const plan = await scopedPlan(schoolId, planId)
      if (plan.status !== 'draft')
        throw new ClassTimetableStateError('Draft timetable required')
      const deleted = await getDatabase().classTimetableEntry.deleteMany({
        where: { id: entryId, timetableId: planId },
      })
      return reply.code(deleted.count ? 204 : 404).send()
    },
  )
  app.get(
    '/schools/:schoolId/timetables/:planId/validation',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, planId } = planParams.parse(request.params)
      await admin(authenticatedUser(request).id, schoolId)
      await scopedPlan(schoolId, planId)
      return { problems: await validateSchoolTimetable(getDatabase(), planId) }
    },
  )
  app.post(
    '/schools/:schoolId/timetables/:planId/publish',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, planId } = planParams.parse(request.params)
      await admin(authenticatedUser(request).id, schoolId)
      await scopedPlan(schoolId, planId)
      return publishClassTimetable(
        getDatabase(),
        authenticatedUser(request).id,
        planId,
      )
    },
  )
  app.post(
    '/schools/:schoolId/timetables/:planId/archive',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, planId } = planParams.parse(request.params)
      await admin(authenticatedUser(request).id, schoolId)
      await scopedPlan(schoolId, planId)
      return archiveClassTimetable(
        getDatabase(),
        authenticatedUser(request).id,
        planId,
      )
    },
  )
  app.get(
    '/schools/:schoolId/timetable/me',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = school.parse(request.params)
      const { academicYearId } = yearQuery.parse(request.query)
      const actorId = authenticatedUser(request).id
      if (!(await activeTeacher(actorId, schoolId)))
        return reply.code(403).send()
      const now = new Date()
      const entries = await getDatabase().classTimetableEntry.findMany({
        where: {
          schoolId,
          academicYearId,
          timetable: { status: 'published' },
          teachingAssignment: {
            userId: actorId,
            startsAt: { lte: now },
            OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          },
        },
        include: { schoolClass: true, subject: true, timetablePeriod: true },
        orderBy: [
          { weekday: 'asc' },
          { timetablePeriod: { sortOrder: 'asc' } },
        ],
      })
      return { entries }
    },
  )
  app.get(
    '/schools/:schoolId/classes/:schoolClassId/timetable',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, schoolClassId } = classParams.parse(request.params)
      const { academicYearId } = yearQuery.parse(request.query)
      const actorId = authenticatedUser(request).id
      let allowed = true
      try {
        await admin(actorId, schoolId)
      } catch {
        const now = new Date()
        allowed =
          !!(await activeTeacher(actorId, schoolId)) &&
          !!(await getDatabase().teachingAssignment.findFirst({
            where: {
              schoolId,
              academicYearId,
              schoolClassId,
              userId: actorId,
              startsAt: { lte: now },
              OR: [{ endsAt: null }, { endsAt: { gt: now } }],
            },
            select: { id: true },
          }))
      }
      if (!allowed) return reply.code(403).send()
      const plan = await getDatabase().classTimetable.findFirst({
        where: { schoolId, academicYearId, schoolClassId, status: 'published' },
        include: {
          entries: {
            include: { subject: true, timetablePeriod: true },
            orderBy: [
              { weekday: 'asc' },
              { timetablePeriod: { sortOrder: 'asc' } },
            ],
          },
        },
      })
      return { timetable: plan }
    },
  )
}
