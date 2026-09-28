import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { assertAttendanceManager } from './attendanceAuthorization.js'

const markSchema = z.strictObject({
  studentId: z.uuid(),
  enrollmentId: z.uuid(),
  status: z.enum(['present', 'absent', 'late', 'excused']),
  note: z.string().trim().max(240).nullable().optional(),
})
export const AttendanceBulkInputSchema = z.strictObject({
  sessionId: z.uuid(),
  marks: z.array(markSchema).max(200),
})
export class AttendanceCaptureError extends Error {}

export async function getAttendanceRoster(
  database: PrismaClient,
  actorId: string,
  sessionId: string,
) {
  const session = await database.attendanceSession.findUnique({
    where: { id: z.uuid().parse(sessionId) },
  })
  if (!session || session.status === 'cancelled')
    throw new AttendanceCaptureError('Attendance session unavailable')
  await assertAttendanceManager(database, actorId, session, session.date)
  const [enrollments, records] = await Promise.all([
    database.enrollment.findMany({
      where: {
        schoolId: session.schoolId,
        academicYearId: session.academicYearId,
        schoolClassId: session.schoolClassId,
        status: 'approved',
      },
      select: {
        id: true,
        studentId: true,
        student: { select: { givenName: true, familyName: true } },
      },
      orderBy: { studentId: 'asc' },
    }),
    database.studentAttendanceRecord.findMany({
      where: { sessionId },
      select: { id: true, studentId: true, status: true, note: true },
    }),
  ])
  return {
    session,
    enrollments,
    records,
    unrecordedCount: enrollments.filter(
      (enrollment) =>
        !records.some((record) => record.studentId === enrollment.studentId),
    ).length,
  }
}

export async function saveBulkAttendance(
  database: PrismaClient,
  actorId: string,
  input: z.input<typeof AttendanceBulkInputSchema>,
) {
  const value = AttendanceBulkInputSchema.parse(input)
  if (
    new Set(value.marks.map((mark) => mark.studentId)).size !==
    value.marks.length
  )
    throw new AttendanceCaptureError('Duplicate student in attendance capture')
  return database.$transaction(
    async (transaction) => {
      const session = await transaction.attendanceSession.findUnique({
        where: { id: value.sessionId },
      })
      if (!session || session.status !== 'open')
        throw new AttendanceCaptureError('Open attendance session required')
      await assertAttendanceManager(
        transaction as PrismaClient,
        actorId,
        session,
        session.date,
      )
      const roster = await transaction.enrollment.findMany({
        where: {
          schoolId: session.schoolId,
          academicYearId: session.academicYearId,
          schoolClassId: session.schoolClassId,
          status: 'approved',
        },
        select: { id: true, studentId: true },
      })
      const eligible = new Set(
        roster.map((enrollment) => `${enrollment.studentId}:${enrollment.id}`),
      )
      if (
        value.marks.some(
          (mark) => !eligible.has(`${mark.studentId}:${mark.enrollmentId}`),
        )
      )
        throw new AttendanceCaptureError('Eligible enrollment required')
      for (const mark of value.marks) {
        await transaction.studentAttendanceRecord.upsert({
          where: {
            sessionId_studentId: {
              sessionId: session.id,
              studentId: mark.studentId,
            },
          },
          create: {
            sessionId: session.id,
            schoolId: session.schoolId,
            academicYearId: session.academicYearId,
            schoolClassId: session.schoolClassId,
            studentId: mark.studentId,
            enrollmentId: mark.enrollmentId,
            status: mark.status,
            note: mark.note ?? null,
            recordedById: actorId,
          },
          update: {
            status: mark.status,
            note: mark.note ?? null,
            recordedById: actorId,
          },
        })
      }
      return { saved: value.marks.length, eligible: roster.length }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function submitAttendanceSession(
  database: PrismaClient,
  actorId: string,
  sessionId: string,
) {
  z.uuid().parse(sessionId)
  return database.$transaction(
    async (transaction) => {
      const session = await transaction.attendanceSession.findUnique({
        where: { id: sessionId },
      })
      if (!session || !['open', 'submitted'].includes(session.status))
        throw new AttendanceCaptureError('Session cannot be submitted')
      await assertAttendanceManager(
        transaction as PrismaClient,
        actorId,
        session,
        session.date,
      )
      if (session.status === 'submitted') return session
      const [roster, records] = await Promise.all([
        transaction.enrollment.findMany({
          where: {
            schoolId: session.schoolId,
            academicYearId: session.academicYearId,
            schoolClassId: session.schoolClassId,
            status: 'approved',
          },
          select: { studentId: true },
        }),
        transaction.studentAttendanceRecord.findMany({
          where: { sessionId },
          select: { studentId: true },
        }),
      ])
      const recorded = new Set(records.map((record) => record.studentId))
      if (roster.some((enrollment) => !recorded.has(enrollment.studentId)))
        throw new AttendanceCaptureError('Unrecorded students remain')
      return transaction.attendanceSession.update({
        where: { id: sessionId },
        data: { status: 'submitted', submittedAt: new Date() },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
