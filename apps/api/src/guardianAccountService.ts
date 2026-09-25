import { hashPassword } from '@warka/auth'
import {
  createUser,
  DuplicateEmailError,
  DuplicateGuardianAccessError,
  hasOrganizationAdminRole,
  linkGuardianUser,
  type PrismaClient,
} from '@warka/database'
import { z } from 'zod'

export const ProvisionGuardianAccountSchema = z.strictObject({
  guardianId: z.uuid(),
  email: z.email(),
  displayName: z.string().trim().min(1).max(200),
  initialPassword: z.string().min(12).max(1024),
})

export type ProvisionGuardianAccount = z.infer<
  typeof ProvisionGuardianAccountSchema
>

export class GuardianAccountUnavailableError extends Error {
  constructor() {
    super('Guardian account is unavailable for this school')
  }
}

export class GuardianAccountConflictError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export type GuardianAccountService = {
  status(
    actorId: string,
    schoolId: string,
    guardianId: string,
  ): Promise<
    | { status: 'none' }
    | {
        status: 'active'
        email: string
        displayName: string
        mustChangePassword: boolean
      }
  >
  create(
    actorId: string,
    schoolId: string,
    input: ProvisionGuardianAccount,
  ): Promise<{
    id: string
    email: string
    displayName: string
    mustChangePassword: boolean
  }>
}

export function prismaGuardianAccountService(
  database: PrismaClient,
): GuardianAccountService {
  async function requireAuthority(
    actorId: string,
    schoolId: string,
    guardianId: string,
    requirePortal: boolean,
  ) {
    const school = await database.school.findUnique({ where: { id: schoolId } })
    if (!school) throw new GuardianAccountUnavailableError()
    const [organizationAdmin, schoolMember, relationship, setting] =
      await Promise.all([
        hasOrganizationAdminRole(database, actorId, school.organizationId),
        database.schoolMembership.findUnique({
          where: { userId_schoolId: { userId: actorId, schoolId } },
        }),
        database.studentGuardian.findFirst({
          where: {
            guardianId,
            verificationStatus: 'verified',
            verificationSchoolId: schoolId,
            student: {
              enrollments: {
                some: { schoolId, status: 'approved' },
              },
            },
          },
        }),
        database.schoolServiceAccess.findUnique({ where: { schoolId } }),
      ])
    if (
      (!organizationAdmin &&
        schoolMember?.role !== 'administrator' &&
        schoolMember?.role !== 'registrar') ||
      !relationship ||
      (requirePortal && !setting?.parentPortalEnabled)
    ) {
      throw new GuardianAccountUnavailableError()
    }
  }
  return {
    async status(actorId, schoolId, guardianId) {
      await requireAuthority(actorId, schoolId, guardianId, false)
      const access = await database.guardianAccess.findUnique({
        where: { guardianId },
        include: {
          user: {
            select: {
              email: true,
              displayName: true,
              passwordCredential: { select: { mustChangePassword: true } },
            },
          },
        },
      })
      if (!access) return { status: 'none' }
      return {
        status: 'active',
        email: access.user.email,
        displayName: access.user.displayName,
        mustChangePassword:
          access.user.passwordCredential?.mustChangePassword ?? false,
      }
    },
    async create(actorId, schoolId, input) {
      const parsed = ProvisionGuardianAccountSchema.parse(input)
      await requireAuthority(actorId, schoolId, parsed.guardianId, true)
      const passwordHash = await hashPassword(parsed.initialPassword)
      try {
        return await database.$transaction(async (transaction) => {
          const [relationship, setting, existing] = await Promise.all([
            transaction.studentGuardian.findFirst({
              where: {
                guardianId: parsed.guardianId,
                verificationStatus: 'verified',
                verificationSchoolId: schoolId,
                student: {
                  enrollments: {
                    some: { schoolId, status: 'approved' },
                  },
                },
              },
            }),
            transaction.schoolServiceAccess.findUnique({
              where: { schoolId },
            }),
            transaction.guardianAccess.findUnique({
              where: { guardianId: parsed.guardianId },
            }),
          ])
          if (!relationship || !setting?.parentPortalEnabled)
            throw new GuardianAccountUnavailableError()
          if (existing)
            throw new GuardianAccountConflictError(
              'Guardian already has an account',
            )
          const user = await createUser(transaction, {
            email: parsed.email,
            displayName: parsed.displayName,
          })
          await transaction.passwordCredential.create({
            data: { userId: user.id, passwordHash, mustChangePassword: true },
          })
          await linkGuardianUser(transaction, user.id, parsed.guardianId)
          return {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            mustChangePassword: true,
          }
        })
      } catch (error) {
        if (error instanceof DuplicateEmailError)
          throw new GuardianAccountConflictError('Email already has an account')
        if (error instanceof DuplicateGuardianAccessError)
          throw new GuardianAccountConflictError(
            'Guardian already has an account',
          )
        throw error
      }
    },
  }
}
