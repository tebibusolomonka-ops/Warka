import { Prisma, type PrismaClient, type StudentAccess } from '@prisma/client'

export class DuplicateStudentAccessError extends Error {
  constructor() {
    super('User or student already has a student access link')
  }
}

type StudentAccessStore = Pick<PrismaClient, 'studentAccess'>

export async function linkStudentUser(
  database: StudentAccessStore,
  userId: string,
  studentId: string,
): Promise<StudentAccess> {
  try {
    return await database.studentAccess.create({ data: { userId, studentId } })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new DuplicateStudentAccessError()
    }
    throw error
  }
}

export function findStudentAccessForUser(
  database: StudentAccessStore,
  userId: string,
) {
  return database.studentAccess.findUnique({
    where: { userId },
    include: { student: true },
  })
}

export function findLinkedUserForStudent(
  database: StudentAccessStore,
  studentId: string,
) {
  return database.studentAccess.findUnique({
    where: { studentId },
    include: { user: true },
  })
}

export async function removeStudentAccess(
  database: StudentAccessStore,
  studentId: string,
): Promise<void> {
  await database.studentAccess.deleteMany({ where: { studentId } })
}
