import { Prisma, type GradingPeriod, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { findAcademicYearById } from './academicYears.js'

export const CreateGradingPeriodSchema = z
  .object({
    schoolId: z.uuid(),
    academicYearId: z.uuid(),
    name: z.string().trim().min(1).max(200),
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
  })
  .refine((period) => period.startsOn < period.endsOn, {
    message: 'Grading period start must be before its end',
    path: ['endsOn'],
  })

export type CreateGradingPeriod = z.input<typeof CreateGradingPeriodSchema>

export class InvalidGradingPeriodError extends Error {
  constructor() {
    super('Grading period must fall within its school academic year')
  }
}

export class DuplicateGradingPeriodError extends Error {
  constructor() {
    super('Grading period name already exists in this academic year')
  }
}

function calendarDate(value: string): Date {
  return new Date(value + 'T00:00:00.000Z')
}

export async function createGradingPeriod(
  database: PrismaClient,
  input: CreateGradingPeriod,
): Promise<GradingPeriod> {
  const data = CreateGradingPeriodSchema.parse(input)
  const year = await findAcademicYearById(
    database,
    data.schoolId,
    data.academicYearId,
  )
  if (
    !year ||
    calendarDate(data.startsOn) < year.startsOn ||
    calendarDate(data.endsOn) > year.endsOn
  ) {
    throw new InvalidGradingPeriodError()
  }
  try {
    return await database.gradingPeriod.create({
      data: {
        schoolId: data.schoolId,
        academicYearId: data.academicYearId,
        name: data.name,
        startsOn: calendarDate(data.startsOn),
        endsOn: calendarDate(data.endsOn),
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new DuplicateGradingPeriodError()
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new InvalidGradingPeriodError()
    }
    throw error
  }
}

export function findGradingPeriodById(
  database: PrismaClient,
  schoolId: string,
  academicYearId: string,
  id: string,
): Promise<GradingPeriod | null> {
  return database.gradingPeriod.findFirst({
    where: { id, schoolId, academicYearId },
  })
}

export function listGradingPeriods(
  database: PrismaClient,
  schoolId: string,
  academicYearId: string,
): Promise<GradingPeriod[]> {
  return database.gradingPeriod.findMany({
    where: { schoolId, academicYearId },
    orderBy: [{ startsOn: 'asc' }, { id: 'asc' }],
  })
}
