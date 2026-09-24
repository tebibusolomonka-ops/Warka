import { Prisma, type PrismaClient, type SchoolClass } from '@prisma/client'
import { z } from 'zod'

export const CreateSchoolClassSchema = z.object({
  schoolId: z.uuid(),
  academicYearId: z.uuid(),
  gradeLevelId: z.uuid(),
  name: z.string().trim().min(1).max(200),
})

export type CreateSchoolClass = z.input<typeof CreateSchoolClassSchema>

export class InvalidClassStructureError extends Error {
  constructor() {
    super('Academic year and grade level must belong to the class school')
  }
}

export class DuplicateSchoolClassError extends Error {
  constructor() {
    super('Class name already exists for this grade and academic year')
  }
}

export async function createSchoolClass(
  database: PrismaClient,
  input: CreateSchoolClass,
): Promise<SchoolClass> {
  const data = CreateSchoolClassSchema.parse(input)
  const [year, grade] = await Promise.all([
    database.academicYear.findFirst({
      where: { id: data.academicYearId, schoolId: data.schoolId },
      select: { id: true },
    }),
    database.gradeLevel.findFirst({
      where: { id: data.gradeLevelId, schoolId: data.schoolId },
      select: { id: true },
    }),
  ])
  if (!year || !grade) throw new InvalidClassStructureError()

  try {
    return await database.schoolClass.create({ data })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new DuplicateSchoolClassError()
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new InvalidClassStructureError()
    }
    throw error
  }
}

export function findSchoolClassById(
  database: PrismaClient,
  schoolId: string,
  id: string,
): Promise<SchoolClass | null> {
  return database.schoolClass.findFirst({ where: { id, schoolId } })
}

export function listClassesForAcademicYear(
  database: PrismaClient,
  schoolId: string,
  academicYearId: string,
): Promise<SchoolClass[]> {
  return database.schoolClass.findMany({
    where: { schoolId, academicYearId },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })
}
