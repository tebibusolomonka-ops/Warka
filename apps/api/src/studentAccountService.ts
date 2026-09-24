import { hashPassword } from '@warka/auth'
import {
  createUser,
  DuplicateEmailError,
  DuplicateStudentAccessError,
  linkStudentUser,
  type PrismaClient,
} from '@warka/database'
import { z } from 'zod'

export const ProvisionStudentAccountSchema = z.strictObject({
  email: z.email(),
  displayName: z.string().trim().min(1).max(200),
  initialPassword: z.string().min(12).max(1024),
})

export type ProvisionStudentAccount = z.infer<
  typeof ProvisionStudentAccountSchema
>

export class StudentAccountConflictError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export class StudentEnrollmentNotFoundError extends Error {
  constructor() {
    super('Student is not enrolled at this school')
  }
}

export type StudentAccountService = {
  create(
    schoolId: string,
    studentId: string,
    input: ProvisionStudentAccount,
  ): Promise<{
    id: string
    email: string
    displayName: string
    mustChangePassword: boolean
  }>
}

export function prismaStudentAccountService(
  database: PrismaClient,
): StudentAccountService {
  return {
    async create(schoolId, studentId, input) {
      const parsed = ProvisionStudentAccountSchema.parse(input)
      const passwordHash = await hashPassword(parsed.initialPassword)
      try {
        return await database.$transaction(async (transaction) => {
          const enrollment = await transaction.enrollment.findFirst({
            where: { schoolId, studentId },
            select: { id: true },
          })
          if (!enrollment) throw new StudentEnrollmentNotFoundError()
          const existing = await transaction.studentAccess.findUnique({
            where: { studentId },
          })
          if (existing)
            throw new StudentAccountConflictError(
              'Student already has an account',
            )
          const user = await createUser(transaction, {
            email: parsed.email,
            displayName: parsed.displayName,
          })
          await transaction.passwordCredential.create({
            data: { userId: user.id, passwordHash, mustChangePassword: true },
          })
          await linkStudentUser(transaction, user.id, studentId)
          return {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            mustChangePassword: true,
          }
        })
      } catch (error) {
        if (error instanceof DuplicateEmailError)
          throw new StudentAccountConflictError('Email already has an account')
        if (error instanceof DuplicateStudentAccessError)
          throw new StudentAccountConflictError(
            'Student already has an account',
          )
        throw error
      }
    },
  }
}
