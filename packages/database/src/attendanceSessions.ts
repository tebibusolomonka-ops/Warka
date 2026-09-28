import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { assertAttendanceManager } from './attendanceAuthorization.js'

export const AttendanceSessionInputSchema = z
  .strictObject({
    schoolId: z.uuid(),
    academicYearId: z.uuid(),
    schoolClassId: z.uuid(),
    date: z.iso.date(),
    timetablePeriodId: z.uuid().optional(),
    subjectId: z.uuid().optional(),
    teachingAssignmentId: z.uuid().optional(),
  })
  .refine(
    (value) =>
      [
        value.timetablePeriodId,
        value.subjectId,
        value.teachingAssignmentId,
      ].filter(Boolean).length === 0 ||
      [
        value.timetablePeriodId,
        value.subjectId,
        value.teachingAssignmentId,
      ].filter(Boolean).length === 3,
    { message: 'Period attendance requires period, subject, and assignment' },
  )

export class AttendanceSessionContextError extends Error {}

export async function createAttendanceSession(
  database: PrismaClient,
  actorId: string,
  input: z.input<typeof AttendanceSessionInputSchema>,
) {
  z.uuid().parse(actorId)
  const value = AttendanceSessionInputSchema.parse(input)
  const date = new Date(`${value.date}T00:00:00.000Z`)
  await assertAttendanceManager(database, actorId, value, date)
  const [year, calendarDay] = await Promise.all([
    database.academicYear.findFirst({
      where: { id: value.academicYearId, schoolId: value.schoolId },
      select: { startsOn: true, endsOn: true },
    }),
    database.schoolCalendarDay.findUnique({
      where: { schoolId_date: { schoolId: value.schoolId, date } },
      select: { dayType: true },
    }),
  ])
  if (!year || date < year.startsOn || date > year.endsOn)
    throw new AttendanceSessionContextError('Date is outside the academic year')
  if (
    calendarDay &&
    ['holiday', 'closure', 'staffDay'].includes(calendarDay.dayType)
  )
    throw new AttendanceSessionContextError('Attendance is closed on this day')
  if (value.timetablePeriodId) {
    const period = await database.timetablePeriod.findFirst({
      where: {
        id: value.timetablePeriodId,
        schoolId: value.schoolId,
        instructional: true,
      },
      select: { id: true },
    })
    if (!period)
      throw new AttendanceSessionContextError('Instructional period required')
  }
  try {
    return await database.attendanceSession.create({
      data: {
        schoolId: value.schoolId,
        academicYearId: value.academicYearId,
        schoolClassId: value.schoolClassId,
        date,
        timetablePeriodId: value.timetablePeriodId ?? null,
        subjectId: value.subjectId ?? null,
        teachingAssignmentId: value.teachingAssignmentId ?? null,
        createdById: actorId,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2003'].includes(error.code)
    )
      throw new AttendanceSessionContextError(
        'Attendance session conflicts with class or scope',
      )
    throw error
  }
}
