import type { Organization, PrismaClient } from '@prisma/client'

export type CreateOrganization = {
  name: string
}

export function createOrganization(
  database: PrismaClient,
  data: CreateOrganization,
): Promise<Organization> {
  return database.organization.create({ data })
}

export function findOrganizationById(
  database: PrismaClient,
  id: string,
): Promise<Organization | null> {
  return database.organization.findUnique({ where: { id } })
}
