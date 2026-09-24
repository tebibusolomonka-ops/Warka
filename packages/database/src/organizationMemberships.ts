import {
  Prisma,
  type Organization,
  type OrganizationMembership,
  type OrganizationRole,
  type PrismaClient,
} from '@prisma/client'
import { z } from 'zod'

export const OrganizationRoleSchema = z.enum(['owner', 'administrator'])

export type CreateOrganizationMembership = {
  userId: string
  organizationId: string
  role: OrganizationRole
}

export type OrganizationAccess = {
  organization: Organization
  role: OrganizationRole
}

export class DuplicateOrganizationMembershipError extends Error {
  constructor() {
    super('User already belongs to this organization')
  }
}

export async function createOrganizationMembership(
  database: PrismaClient,
  data: CreateOrganizationMembership,
): Promise<OrganizationMembership> {
  const role = OrganizationRoleSchema.parse(data.role)
  try {
    return await database.organizationMembership.create({
      data: { ...data, role },
    })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new DuplicateOrganizationMembershipError()
    }
    throw error
  }
}

export function findOrganizationMembership(
  database: PrismaClient,
  userId: string,
  organizationId: string,
): Promise<OrganizationMembership | null> {
  return database.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  })
}

export async function listOrganizationsForUser(
  database: PrismaClient,
  userId: string,
): Promise<OrganizationAccess[]> {
  const memberships = await database.organizationMembership.findMany({
    where: { userId },
    include: { organization: true },
    orderBy: [{ organization: { name: 'asc' } }, { organizationId: 'asc' }],
  })
  return memberships.map(({ organization, role }) => ({ organization, role }))
}

export async function hasOrganizationAdminRole(
  database: PrismaClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const membership = await findOrganizationMembership(
    database,
    userId,
    organizationId,
  )
  return membership?.role === 'owner' || membership?.role === 'administrator'
}
