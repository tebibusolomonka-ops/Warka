import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const databaseUrlSchema = z.url().refine(
  (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
  'DATABASE_URL must use PostgreSQL',
)

export function createDatabaseClient(env: NodeJS.ProcessEnv = process.env): PrismaClient {
  const result = databaseUrlSchema.safeParse(env.DATABASE_URL)
  if (!result.success) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL')
  }

  return new PrismaClient({ datasourceUrl: result.data })
}

export type { PrismaClient }
export { createOrganization, findOrganizationById } from './organizations.js'
export type { CreateOrganization } from './organizations.js'
export { createSchool, findSchoolById, listSchoolsForOrganization } from './schools.js'
export type { CreateSchool } from './schools.js'
export type { Organization, School } from '@prisma/client'
