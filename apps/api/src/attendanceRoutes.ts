import type { FastifyInstance, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import {
  AttendanceBulkInputSchema,
  AttendanceCorrectionInputSchema,
  AttendancePermissionError,
  AttendanceSessionInputSchema,
  StudentAttendanceRecordInputSchema,
  assertAttendanceManager,
  correctAttendance,
  createAttendanceSession,
  createStudentAttendanceRecord,
  getAttendanceRoster,
  getAttendanceSummary,
  saveBulkAttendance,
  submitAttendanceSession,
  type PrismaClient,
} from '@warka/database'
import { authenticatedUser } from './authenticateRequest.js'

const schoolParams = z.strictObject({ schoolId: z.uuid() })
const sessionParams = schoolParams.extend({ sessionId: z.uuid() })
const studentParams = schoolParams.extend({ studentId: z.uuid() })
const listQuery = z.strictObject({
  academicYearId: z.uuid(),
  schoolClassId: z.uuid(),
  date: z.iso.date().optional(),
})
const historyQuery = z.strictObject({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})
const sessionBody = z
  .strictObject(AttendanceSessionInputSchema.shape)
  .omit({ schoolId: true })

export function registerAttendanceRoutes(
  app: FastifyInstance,
  getDatabase: () => PrismaClient,
  authenticate: preHandlerHookHandler,
) {
  const actor = (request: Parameters<typeof authenticatedUser>[0]) =>
    authenticatedUser(request).id
  async function familyHistory(studentId: string, schoolId?: string) {
    const records = await getDatabase().studentAttendanceRecord.findMany({
      where: {
        studentId,
        ...(schoolId ? { schoolId } : {}),
        session: { status: 'finalized' },
      },
      include: {
        session: {
          select: {
            date: true,
            schoolClass: { select: { name: true } },
            subject: { select: { name: true } },
          },
        },
      },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    })
    return {
      records: records.map((record) => ({
        id: record.id,
        date: record.session.date,
        className: record.session.schoolClass.name,
        subjectName: record.session.subject?.name ?? null,
        status: record.status,
      })),
    }
  }
  async function scopedSession(schoolId: string, sessionId: string) {
    return getDatabase().attendanceSession.findFirst({
      where: { id: sessionId, schoolId },
    })
  }

  app.get(
    '/student/attendance',
    { preHandler: authenticate },
    async (request, reply) => {
      const access = await getDatabase().studentAccess.findUnique({
        where: { userId: actor(request) },
      })
      if (!access) return reply.code(403).send()
      return familyHistory(access.studentId)
    },
  )

  app.get(
    '/parent/children/:studentReference/attendance',
    { preHandler: authenticate },
    async (request, reply) => {
      const { studentReference } = z
        .strictObject({ studentReference: z.string().min(1).max(120) })
        .parse(request.params)
      const { schoolId } = schoolParams.parse(request.query)
      const access = await getDatabase().guardianAccess.findUnique({
        where: { userId: actor(request) },
      })
      if (!access) return reply.code(403).send()
      const student = await getDatabase().student.findUnique({
        where: { studentReference },
        select: { id: true },
      })
      if (!student) return reply.code(404).send()
      const link = await getDatabase().studentGuardian.findFirst({
        where: {
          guardianId: access.guardianId,
          studentId: student.id,
          verificationStatus: 'verified',
          verificationSchoolId: schoolId,
          revokedAt: null,
        },
      })
      if (!link) return reply.code(403).send()
      return familyHistory(student.id, schoolId)
    },
  )

  app.get(
    '/schools/:schoolId/attendance/sessions',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      const query = listQuery.parse(request.query)
      await assertAttendanceManager(
        getDatabase(),
        actor(request),
        {
          schoolId,
          academicYearId: query.academicYearId,
          schoolClassId: query.schoolClassId,
        },
        new Date(),
      )
      const membership = await getDatabase().schoolMembership.findUnique({
        where: { userId_schoolId: { userId: actor(request), schoolId } },
      })
      const ownAssignmentIds =
        membership?.role === 'teacher'
          ? (
              await getDatabase().teachingAssignment.findMany({
                where: {
                  userId: actor(request),
                  schoolId,
                  academicYearId: query.academicYearId,
                  schoolClassId: query.schoolClassId,
                  startsAt: { lte: new Date() },
                  OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
                },
                select: { id: true },
              })
            ).map((assignment) => assignment.id)
          : null
      return {
        sessions: await getDatabase().attendanceSession.findMany({
          where: {
            schoolId,
            academicYearId: query.academicYearId,
            schoolClassId: query.schoolClassId,
            ...(ownAssignmentIds
              ? { teachingAssignmentId: { in: ownAssignmentIds } }
              : {}),
            ...(query.date
              ? { date: new Date(`${query.date}T00:00:00.000Z`) }
              : {}),
          },
          orderBy: { date: 'desc' },
          take: 100,
        }),
      }
    },
  )

  app.get(
    '/schools/:schoolId/attendance/summary',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      const { academicYearId } = z
        .strictObject({ academicYearId: z.uuid() })
        .parse(request.query)
      const now = new Date()
      const membership = await getDatabase().schoolMembership.findUnique({
        where: { userId_schoolId: { userId: actor(request), schoolId } },
      })
      if (
        membership?.role !== 'administrator' ||
        membership.startsAt > now ||
        (membership.endsAt && membership.endsAt <= now)
      )
        throw new AttendancePermissionError()
      return getAttendanceSummary(getDatabase(), { schoolId, academicYearId })
    },
  )

  app.get(
    '/schools/:schoolId/attendance/classes/:schoolClassId/summary',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId, schoolClassId } = schoolParams
        .extend({ schoolClassId: z.uuid() })
        .parse(request.params)
      const { academicYearId } = z
        .strictObject({ academicYearId: z.uuid() })
        .parse(request.query)
      await assertAttendanceManager(
        getDatabase(),
        actor(request),
        { schoolId, academicYearId, schoolClassId },
        new Date(),
      )
      return getAttendanceSummary(getDatabase(), {
        schoolId,
        academicYearId,
        schoolClassId,
      })
    },
  )

  app.get(
    '/schools/:schoolId/attendance/students/:studentId/summary',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, studentId } = studentParams.parse(request.params)
      const { academicYearId } = z
        .strictObject({ academicYearId: z.uuid() })
        .parse(request.query)
      const enrollment = await getDatabase().enrollment.findFirst({
        where: {
          schoolId,
          academicYearId,
          studentId,
          status: 'approved',
          schoolClassId: { not: null },
        },
        select: { schoolClassId: true },
      })
      if (!enrollment?.schoolClassId) return reply.code(404).send()
      await assertAttendanceManager(
        getDatabase(),
        actor(request),
        { schoolId, academicYearId, schoolClassId: enrollment.schoolClassId },
        new Date(),
      )
      return getAttendanceSummary(getDatabase(), {
        schoolId,
        academicYearId,
        schoolClassId: enrollment.schoolClassId,
        studentId,
      })
    },
  )

  app.post(
    '/schools/:schoolId/attendance/sessions',
    { preHandler: authenticate },
    async (request) => {
      const { schoolId } = schoolParams.parse(request.params)
      const body = sessionBody.parse(request.body)
      return createAttendanceSession(getDatabase(), actor(request), {
        ...body,
        schoolId,
      })
    },
  )

  app.get(
    '/schools/:schoolId/attendance/sessions/:sessionId',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, sessionId } = sessionParams.parse(request.params)
      const session = await scopedSession(schoolId, sessionId)
      if (!session) return reply.code(404).send()
      await assertAttendanceManager(
        getDatabase(),
        actor(request),
        session,
        session.date,
      )
      return { session }
    },
  )

  app.get(
    '/schools/:schoolId/attendance/sessions/:sessionId/roster',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, sessionId } = sessionParams.parse(request.params)
      if (!(await scopedSession(schoolId, sessionId)))
        return reply.code(404).send()
      return getAttendanceRoster(getDatabase(), actor(request), sessionId)
    },
  )

  app.post(
    '/schools/:schoolId/attendance/sessions/:sessionId/records',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, sessionId } = sessionParams.parse(request.params)
      if (!(await scopedSession(schoolId, sessionId)))
        return reply.code(404).send()
      const body = StudentAttendanceRecordInputSchema.omit({
        sessionId: true,
      }).parse(request.body)
      return createStudentAttendanceRecord(getDatabase(), actor(request), {
        ...body,
        sessionId,
      })
    },
  )

  app.put(
    '/schools/:schoolId/attendance/sessions/:sessionId/records/bulk',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, sessionId } = sessionParams.parse(request.params)
      if (!(await scopedSession(schoolId, sessionId)))
        return reply.code(404).send()
      const body = AttendanceBulkInputSchema.omit({ sessionId: true }).parse(
        request.body,
      )
      return saveBulkAttendance(getDatabase(), actor(request), {
        ...body,
        sessionId,
      })
    },
  )

  app.post(
    '/schools/:schoolId/attendance/sessions/:sessionId/submit',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, sessionId } = sessionParams.parse(request.params)
      if (!(await scopedSession(schoolId, sessionId)))
        return reply.code(404).send()
      return submitAttendanceSession(getDatabase(), actor(request), sessionId)
    },
  )

  app.post(
    '/schools/:schoolId/attendance/sessions/:sessionId/finalize',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, sessionId } = sessionParams.parse(request.params)
      const session = await scopedSession(schoolId, sessionId)
      if (!session) return reply.code(404).send()
      const membership = await getDatabase().schoolMembership.findUnique({
        where: { userId_schoolId: { userId: actor(request), schoolId } },
      })
      const now = new Date()
      if (
        membership?.role !== 'administrator' ||
        membership.startsAt > now ||
        (membership.endsAt && membership.endsAt <= now)
      )
        throw new AttendancePermissionError()
      if (session.status !== 'submitted') return reply.code(409).send()
      return getDatabase().attendanceSession.update({
        where: { id: sessionId },
        data: { status: 'finalized', finalizedAt: now },
      })
    },
  )

  app.post(
    '/schools/:schoolId/attendance/corrections',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId } = schoolParams.parse(request.params)
      const body = AttendanceCorrectionInputSchema.parse(request.body)
      const record = await getDatabase().studentAttendanceRecord.findFirst({
        where: { id: body.recordId, schoolId },
        select: { id: true },
      })
      if (!record) return reply.code(404).send()
      return correctAttendance(getDatabase(), actor(request), body)
    },
  )

  app.get(
    '/schools/:schoolId/attendance/sessions/:sessionId/corrections',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, sessionId } = sessionParams.parse(request.params)
      const session = await scopedSession(schoolId, sessionId)
      if (!session) return reply.code(404).send()
      await assertAttendanceManager(
        getDatabase(),
        actor(request),
        session,
        session.date,
      )
      return {
        corrections: await getDatabase().attendanceCorrection.findMany({
          where: { record: { sessionId } },
          orderBy: { effectiveAt: 'desc' },
          take: 100,
        }),
      }
    },
  )

  app.get(
    '/schools/:schoolId/attendance/students/:studentId/history',
    { preHandler: authenticate },
    async (request, reply) => {
      const { schoolId, studentId } = studentParams.parse(request.params)
      const { cursor, limit } = historyQuery.parse(request.query)
      const actorId = actor(request)
      const [studentAccess, guardianAccess, staffMembership] =
        await Promise.all([
          getDatabase().studentAccess.findUnique({
            where: { userId: actorId },
          }),
          getDatabase().guardianAccess.findUnique({
            where: { userId: actorId },
          }),
          getDatabase().schoolMembership.findUnique({
            where: { userId_schoolId: { userId: actorId, schoolId } },
          }),
        ])
      const own = studentAccess?.studentId === studentId
      const linked = guardianAccess
        ? Boolean(
            await getDatabase().studentGuardian.findFirst({
              where: {
                guardianId: guardianAccess.guardianId,
                studentId,
                verificationStatus: 'verified',
                verificationSchoolId: schoolId,
                revokedAt: null,
              },
            }),
          )
        : false
      const now = new Date()
      const staff = Boolean(
        staffMembership &&
        ['administrator', 'teacher'].includes(staffMembership.role) &&
        staffMembership.startsAt <= now &&
        (!staffMembership.endsAt || staffMembership.endsAt > now),
      )
      if (!own && !linked && !staff) return reply.code(403).send()
      const teacherClassIds =
        staffMembership?.role === 'teacher' && !own && !linked
          ? (
              await getDatabase().teachingAssignment.findMany({
                where: {
                  userId: actorId,
                  schoolId,
                  startsAt: { lte: now },
                  OR: [{ endsAt: null }, { endsAt: { gt: now } }],
                },
                select: { schoolClassId: true },
              })
            ).map((assignment) => assignment.schoolClassId)
          : null
      if (teacherClassIds?.length === 0) return reply.code(403).send()
      const records = await getDatabase().studentAttendanceRecord.findMany({
        where: {
          schoolId,
          studentId,
          ...(teacherClassIds
            ? { schoolClassId: { in: teacherClassIds } }
            : {}),
          session: { status: 'finalized' },
        },
        include: {
          session: {
            select: {
              date: true,
              schoolClass: { select: { name: true } },
              subject: { select: { name: true } },
            },
          },
        },
        orderBy: { id: 'desc' },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      return {
        records: records.map((record) => ({
          id: record.id,
          date: record.session.date,
          className: record.session.schoolClass.name,
          subjectName: record.session.subject?.name ?? null,
          status: record.status,
        })),
        nextCursor:
          records.length === limit ? (records.at(-1)?.id ?? null) : null,
      }
    },
  )
}
