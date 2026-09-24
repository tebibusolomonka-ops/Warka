import type { PrismaClient, Student } from '@prisma/client'
import { z } from 'zod'
import {
  CreateStudentSchema,
  createStudent,
  type CreateStudent,
} from './students.js'

type StudentStore = Pick<PrismaClient, 'student'>

export type PossibleDuplicate = Pick<
  Student,
  'id' | 'studentReference' | 'givenName' | 'familyName' | 'dateOfBirth'
>

export type StudentRegistration = {
  student: Student
  possibleDuplicates: PossibleDuplicate[]
}

function normalizedName(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLowerCase()
}

export async function findPossibleDuplicates(
  database: StudentStore,
  schoolId: string,
  input: CreateStudent,
): Promise<PossibleDuplicate[]> {
  const data = CreateStudentSchema.parse(input)
  z.uuid().parse(schoolId)
  if (!data.dateOfBirth) return []

  const candidates = await database.student.findMany({
    where: {
      dateOfBirth: new Date(data.dateOfBirth + 'T00:00:00.000Z'),
      enrollments: { some: { schoolId } },
    },
    select: {
      id: true,
      studentReference: true,
      givenName: true,
      familyName: true,
      dateOfBirth: true,
    },
    orderBy: { studentReference: 'asc' },
  })
  const givenName = normalizedName(data.givenName)
  const familyName = normalizedName(data.familyName)
  return candidates.filter(
    (candidate) =>
      candidate.dateOfBirth?.toISOString().slice(0, 10) === data.dateOfBirth &&
      normalizedName(candidate.givenName) === givenName &&
      normalizedName(candidate.familyName) === familyName,
  )
}

export async function registerStudentRecord(
  database: StudentStore,
  schoolId: string,
  input: CreateStudent,
): Promise<StudentRegistration> {
  const possibleDuplicates = await findPossibleDuplicates(
    database,
    schoolId,
    input,
  )
  const student = await createStudent(database, input)
  return { student, possibleDuplicates }
}
