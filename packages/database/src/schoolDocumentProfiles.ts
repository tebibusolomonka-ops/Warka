import type { Prisma, PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { hasOrganizationAdminRole } from './organizationMemberships.js'
import { recordAuditEvent } from './auditEvents.js'

export class SchoolDocumentProfilePermissionError extends Error {
  constructor() {
    super('School document profile permission denied')
  }
}
const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).nullable().optional()
export const SchoolDocumentProfileInputSchema = z.strictObject({
  officialName: optionalText(200),
  addressLine: optionalText(250),
  city: optionalText(100),
  region: optionalText(100),
  phone: optionalText(40),
  email: z.union([z.email().max(254), z.null()]).optional(),
  website: z
    .union([
      z
        .url()
        .refine(
          (value) =>
            ['http:', 'https:'].includes(new URL(value).protocol) &&
            !new URL(value).username &&
            !new URL(value).password,
        ),
      z.null(),
    ])
    .optional(),
  documentFooter: optionalText(400),
})

async function requirePermission(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  write: boolean,
) {
  z.uuid().parse(actorId)
  z.uuid().parse(schoolId)
  const school = await database.school.findUnique({
    where: { id: schoolId },
    select: { organizationId: true },
  })
  if (!school) throw new SchoolDocumentProfilePermissionError()
  if (await hasOrganizationAdminRole(database, actorId, school.organizationId))
    return
  const membership = await database.schoolMembership.findUnique({
    where: { userId_schoolId: { userId: actorId, schoolId } },
  })
  if (
    !membership ||
    (write
      ? membership.role !== 'administrator'
      : !['administrator', 'registrar'].includes(membership.role))
  )
    throw new SchoolDocumentProfilePermissionError()
}

export async function getSchoolDocumentProfile(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  await requirePermission(database, actorId, schoolId, false)
  return database.schoolDocumentProfile.findUnique({ where: { schoolId } })
}

export async function saveSchoolDocumentProfile(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  input: unknown,
) {
  const data = SchoolDocumentProfileInputSchema.parse(input)
  const fields = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as Omit<Prisma.SchoolDocumentProfileUncheckedCreateInput, 'schoolId'>
  await requirePermission(database, actorId, schoolId, true)
  return database.$transaction(async (transaction) => {
    const profile = await transaction.schoolDocumentProfile.upsert({
      where: { schoolId },
      create: { schoolId, ...fields },
      update: fields,
    })
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'schoolDocumentProfile.updated',
      resourceType: 'schoolDocumentProfile',
      resourceId: schoolId,
    })
    return profile
  })
}
