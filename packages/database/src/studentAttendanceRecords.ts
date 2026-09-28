import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { assertAttendanceManager } from './attendanceAuthorization.js'

export const StudentAttendanceRecordInputSchema = z.strictObject({
  sessionId: z.uuid(),
  studentId: z.uuid(),
  enrollmentId: z.uuid(),
  status: z.enum(['present', 'absent', 'late', 'excused']),
  note: z.string().trim().max(240).nullable().optional(),
})

export class StudentAttendanceRecordError extends Error {}

export async function createStudentAttendanceRecord(
  database: PrismaClient,
  actorId: string,
  input: z.input<typeof StudentAttendanceRecordInputSchema>,
) {
  z.uuid().parse(actorId)
  const value = StudentAttendanceRecordInputSchema.parse(input)
  const session = await database.attendanceSession.findUnique({
    where: { id: value.sessionId },
  })
  if (!session || session.status !== 'open')
    throw new StudentAttendanceRecordError('Open attendance session required')
  await assertAttendanceManager(database, actorId, session, session.date)
  const enrollment = await database.enrollment.findFirst({
    where: {
      id: value.enrollmentId,
      studentId: value.studentId,
      schoolId: session.schoolId,
      academicYearId: session.academicYearId,
      schoolClassId: session.schoolClassId,
      status: 'approved',
    },
    select: { id: true },
  })
  if (!enrollment)
    throw new StudentAttendanceRecordError('Eligible enrollment required')
  try {
    return await database.studentAttendanceRecord.create({
      data: {
        sessionId: session.id,
        schoolId: session.schoolId,
        academicYearId: session.academicYearId,
        schoolClassId: session.schoolClassId,
        studentId: value.studentId,
        enrollmentId: value.enrollmentId,
        status: value.status,
        note: value.note ?? null,
        recordedById: actorId,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2003'].includes(error.code)
    )
      throw new StudentAttendanceRecordError(
        'Attendance record already exists or scope changed',
      )
    throw error
  }
}
