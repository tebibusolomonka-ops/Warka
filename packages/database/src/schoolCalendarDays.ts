import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const SchoolCalendarDayInputSchema = z.strictObject({
  schoolId: z.uuid(),
  academicYearId: z.uuid(),
  date: z.iso.date(),
  dayType: z.enum([
    'instructional',
    'holiday',
    'closure',
    'examination',
    'staffDay',
  ]),
  label: z.string().trim().min(1).max(160).nullable().optional(),
})

export class SchoolCalendarDayError extends Error {}

export async function createSchoolCalendarDay(
  database: PrismaClient,
  input: z.input<typeof SchoolCalendarDayInputSchema>,
) {
  const value = SchoolCalendarDayInputSchema.parse(input)
  const year = await database.academicYear.findFirst({
    where: { id: value.academicYearId, schoolId: value.schoolId },
    select: { startsOn: true, endsOn: true },
  })
  const date = new Date(`${value.date}T00:00:00.000Z`)
  if (!year || date < year.startsOn || date > year.endsOn)
    throw new SchoolCalendarDayError('Date is outside the school year')
  try {
    return await database.schoolCalendarDay.create({
      data: {
        schoolId: value.schoolId,
        academicYearId: value.academicYearId,
        date,
        dayType: value.dayType,
        label: value.label ?? null,
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new SchoolCalendarDayError('Conflicting calendar day')
    throw error
  }
}

export async function listSchoolCalendarDays(
  database: PrismaClient,
  schoolId: string,
  academicYearId: string,
) {
  return database.schoolCalendarDay.findMany({
    where: { schoolId, academicYearId },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  })
}
