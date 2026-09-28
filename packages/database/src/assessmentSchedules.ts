import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'

const clockTime = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)

export const AssessmentScheduleInputSchema = z
  .strictObject({
    schoolId: z.uuid(),
    academicYearId: z.uuid(),
    gradingPeriodId: z.uuid(),
    schoolClassId: z.uuid(),
    subjectId: z.uuid(),
    assessmentId: z.uuid(),
    roomId: z.uuid().optional(),
    scheduledDate: z.iso.date(),
    startTime: clockTime,
    endTime: clockTime,
  })
  .refine((value) => value.startTime < value.endTime, {
    path: ['endTime'],
    message: 'Assessment must end after it starts',
  })

export class AssessmentScheduleContextError extends Error {}

export async function createAssessmentSchedule(
  database: PrismaClient,
  input: z.input<typeof AssessmentScheduleInputSchema>,
) {
  const value = AssessmentScheduleInputSchema.parse(input)
  const date = new Date(`${value.scheduledDate}T00:00:00.000Z`)
  const [assessment, period, year, room] = await Promise.all([
    database.assessment.findFirst({
      where: {
        id: value.assessmentId,
        schoolId: value.schoolId,
        academicYearId: value.academicYearId,
        gradingPeriodId: value.gradingPeriodId,
        schoolClassId: value.schoolClassId,
        subjectId: value.subjectId,
      },
      select: { id: true },
    }),
    database.gradingPeriod.findFirst({
      where: {
        id: value.gradingPeriodId,
        schoolId: value.schoolId,
        academicYearId: value.academicYearId,
      },
      select: { startsOn: true, endsOn: true },
    }),
    database.academicYear.findFirst({
      where: { id: value.academicYearId, schoolId: value.schoolId },
      select: { startsOn: true, endsOn: true },
    }),
    value.roomId
      ? database.assessmentRoom.findFirst({
          where: { id: value.roomId, schoolId: value.schoolId, active: true },
          select: { id: true },
        })
      : Promise.resolve(null),
  ])
  if (
    !assessment ||
    !period ||
    !year ||
    (value.roomId && !room) ||
    date < period.startsOn ||
    date > period.endsOn ||
    date < year.startsOn ||
    date > year.endsOn
  ) {
    throw new AssessmentScheduleContextError(
      'Invalid assessment schedule context',
    )
  }
  try {
    return await database.assessmentSchedule.create({
      data: {
        schoolId: value.schoolId,
        academicYearId: value.academicYearId,
        gradingPeriodId: value.gradingPeriodId,
        schoolClassId: value.schoolClassId,
        subjectId: value.subjectId,
        assessmentId: value.assessmentId,
        roomId: value.roomId ?? null,
        scheduledDate: date,
        startTime: value.startTime,
        endTime: value.endTime,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new AssessmentScheduleContextError(
        'Invalid assessment schedule relationship',
      )
    }
    throw error
  }
}
