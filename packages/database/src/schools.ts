import type { PrismaClient, School } from '@prisma/client'

export type CreateSchool = {
  organizationId: string
  name: string
}

export function createSchool(database: PrismaClient, data: CreateSchool): Promise<School> {
  return database.school.create({ data })
}

export function findSchoolById(database: PrismaClient, id: string): Promise<School | null> {
  return database.school.findUnique({ where: { id } })
}

export function listSchoolsForOrganization(
  database: PrismaClient,
  organizationId: string,
): Promise<School[]> {
  return database.school.findMany({
    where: { organizationId },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  })
}
