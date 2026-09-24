import { Prisma, type GradeLevel, type PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const CreateGradeLevelSchema = z.object({
  schoolId: z.uuid(),
  name: z.string().trim().min(1).max(200),
})

export type CreateGradeLevel = z.input<typeof CreateGradeLevelSchema>

export class DuplicateGradeLevelError extends Error {
  constructor() {
    super('Grade level name already exists in this school')
  }
}

export async function createGradeLevel(
  database: PrismaClient,
  input: CreateGradeLevel,
): Promise<GradeLevel> {
  const data = CreateGradeLevelSchema.parse(input)
  try {
    return await database.gradeLevel.create({ data })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new DuplicateGradeLevelError()
    }
    throw error
  }
}

export function listGradeLevelsForSchool(
  database: PrismaClient,
  schoolId: string,
): Promise<GradeLevel[]> {
  return database.gradeLevel.findMany({
    where: { schoolId },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })
}
