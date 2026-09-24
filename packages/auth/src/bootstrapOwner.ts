import { normalizeEmail, type PrismaClient } from '@warka/database'
import { NameSchema } from '@warka/shared'
import { hashPassword } from './passwords.js'

export type BootstrapOwnerInput = {
  email: string
  displayName: string
  password: string
  organizationName: string
}

export class BootstrapConflictError extends Error {
  constructor() {
    super('Owner account or organization already exists')
  }
}

export async function bootstrapOwner(
  database: PrismaClient,
  input: BootstrapOwnerInput,
) {
  const email = normalizeEmail(input.email)
  const displayName = NameSchema.parse(input.displayName)
  const organizationName = NameSchema.parse(input.organizationName)
  const passwordHash = await hashPassword(input.password)

  return database.$transaction(
    async (transaction) => {
      const existingUser = await transaction.user.findUnique({
        where: { email },
      })
      const existingOrganization = await transaction.organization.findFirst({
        where: { name: organizationName },
      })
      if (existingUser || existingOrganization) {
        throw new BootstrapConflictError()
      }

      const user = await transaction.user.create({
        data: { email, displayName },
      })
      const organization = await transaction.organization.create({
        data: { name: organizationName },
      })
      await transaction.passwordCredential.create({
        data: { userId: user.id, passwordHash },
      })
      await transaction.organizationMembership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'owner',
        },
      })

      return { user, organization }
    },
    { isolationLevel: 'Serializable' },
  )
}
