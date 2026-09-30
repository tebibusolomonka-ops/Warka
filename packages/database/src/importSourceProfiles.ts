import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { hasOrganizationAdminRole } from './organizationMemberships.js'
import { requireSchoolImportPermission } from './importJobs.js'

const MappingEntrySchema = z.strictObject({
  sourceColumn: z.string().trim().min(1).max(120),
  targetField: z.string().trim().min(1).max(80),
})

export const ImportSourceProfileInputSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(120),
    schoolId: z.uuid().optional(),
    organizationId: z.uuid().optional(),
    format: z.enum(['csv', 'xlsx']),
    entityType: z.enum(['student', 'school', 'staff']),
    mapping: z.strictObject({
      version: z.literal(1),
      columns: z.array(MappingEntrySchema).max(100),
    }),
  })
  .refine(
    (value) => Boolean(value.schoolId) !== Boolean(value.organizationId),
    'Exactly one profile scope is required',
  )

export async function createImportSourceProfile(
  database: PrismaClient,
  actorUserId: string,
  input: unknown,
) {
  const data = ImportSourceProfileInputSchema.parse(input)
  z.uuid().parse(actorUserId)
  if (data.schoolId)
    await requireSchoolImportPermission(database, actorUserId, data.schoolId)
  else if (
    !(await hasOrganizationAdminRole(
      database,
      actorUserId,
      data.organizationId!,
    ))
  )
    throw new Error('Import profile permission denied')
  return database.importSourceProfile.create({
    data: {
      name: data.name,
      format: data.format,
      entityType: data.entityType,
      ...(data.schoolId ? { schoolId: data.schoolId } : {}),
      ...(data.organizationId ? { organizationId: data.organizationId } : {}),
      mapping: data.mapping as Prisma.InputJsonValue,
      createdById: actorUserId,
      updatedById: actorUserId,
    },
  })
}
