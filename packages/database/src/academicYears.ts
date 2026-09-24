import { Prisma, type AcademicYear, type PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const CreateAcademicYearSchema = z
  .object({
    schoolId: z.uuid(),
    name: z.string().trim().min(1).max(200),
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
  })
  .refine((year) => year.startsOn < year.endsOn, {
    message: 'Academic year start must be before its end',
    path: ['endsOn'],
  })

export type CreateAcademicYear = z.input<typeof CreateAcademicYearSchema>

export class DuplicateAcademicYearError extends Error {
  constructor() {
    super('Academic year name already exists in this school')
  }
}

function calendarDate(value: string): Date {
  return new Date(value + 'T00:00:00.000Z')
}

export async function createAcademicYear(
  database: PrismaClient,
  input: CreateAcademicYear,
): Promise<AcademicYear> {
  const data = CreateAcademicYearSchema.parse(input)
  try {
    return await database.academicYear.create({
      data: {
        schoolId: data.schoolId,
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
      throw new DuplicateAcademicYearError()
    }
    throw error
  }
}

export function findAcademicYearById(
  database: PrismaClient,
  schoolId: string,
  id: string,
): Promise<AcademicYear | null> {
  return database.academicYear.findFirst({ where: { id, schoolId } })
}

export function listAcademicYearsForSchool(
  database: PrismaClient,
  schoolId: string,
): Promise<AcademicYear[]> {
  return database.academicYear.findMany({
    where: { schoolId },
    orderBy: [{ startsOn: 'desc' }, { id: 'asc' }],
  })
}
