import { randomBytes } from 'node:crypto'
import { Prisma, type PrismaClient, type Student } from '@prisma/client'
import { z } from 'zod'

export const CreateStudentSchema = z.strictObject({
  givenName: z.string().trim().min(1).max(100),
  familyName: z.string().trim().min(1).max(100).optional(),
  dateOfBirth: z.iso.date().optional(),
})

export type CreateStudent = z.input<typeof CreateStudentSchema>

export function generateStudentReference(): string {
  return 'WKA-' + randomBytes(10).toString('hex').toUpperCase()
}

type StudentStore = Pick<PrismaClient, 'student'>

export async function createStudent(
  database: StudentStore,
  input: CreateStudent,
): Promise<Student> {
  const student = CreateStudentSchema.parse(input)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await database.student.create({
        data: {
          givenName: student.givenName,
          ...(student.familyName ? { familyName: student.familyName } : {}),
          ...(student.dateOfBirth
            ? { dateOfBirth: new Date(student.dateOfBirth + 'T00:00:00.000Z') }
            : {}),
          studentReference: generateStudentReference(),
        },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        Array.isArray(error.meta?.target) &&
        error.meta.target.includes('studentReference') &&
        attempt < 2
      ) {
        continue
      }
      throw error
    }
  }
  throw new Error('Could not generate a unique student reference')
}

export function findStudentById(
  database: StudentStore,
  id: string,
): Promise<Student | null> {
  return database.student.findUnique({ where: { id } })
}

export function findStudentByReference(
  database: StudentStore,
  studentReference: string,
): Promise<Student | null> {
  return database.student.findUnique({ where: { studentReference } })
}
