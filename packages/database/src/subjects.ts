import { Prisma, type PrismaClient, type Subject } from '@prisma/client'
import { z } from 'zod'

export const CreateSubjectSchema = z.object({
  schoolId: z.uuid(),
  name: z.string().trim().min(1).max(200),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(40)
    .regex(/^[A-Z0-9][A-Z0-9._-]*$/)
    .optional(),
})

export type CreateSubject = z.input<typeof CreateSubjectSchema>

export class DuplicateSubjectError extends Error {
  constructor() {
    super('Subject name or code already exists in this school')
  }
}

export async function createSubject(
  database: PrismaClient,
  input: CreateSubject,
): Promise<Subject> {
  const data = CreateSubjectSchema.parse(input)
  try {
    return await database.subject.create({
      data: {
        schoolId: data.schoolId,
        name: data.name,
        ...(data.code ? { code: data.code } : {}),
      },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new DuplicateSubjectError()
    }
    throw error
  }
}

export function findSubjectById(
  database: PrismaClient,
  schoolId: string,
  id: string,
): Promise<Subject | null> {
  return database.subject.findFirst({ where: { id, schoolId } })
}

export function listSubjectsForSchool(
  database: PrismaClient,
  schoolId: string,
): Promise<Subject[]> {
  return database.subject.findMany({
    where: { schoolId },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })
}
