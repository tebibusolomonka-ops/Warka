import type { PrismaClient, SchoolServiceAccess } from '@prisma/client'
import { recordAuditEvent } from './auditEvents.js'
import { hasOrganizationAdminRole } from './organizationMemberships.js'
import { hasActiveVerifiedGuardianRelationship } from './guardianRelationships.js'

export class ParentServicePermissionError extends Error {
  constructor() {
    super('Parent portal setting is unavailable for this school')
  }
}

async function requireSchoolAdministrator(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  const school = await database.school.findUnique({ where: { id: schoolId } })
  if (!school) throw new ParentServicePermissionError()
  const organizationAdmin = await hasOrganizationAdminRole(
    database,
    actorId,
    school.organizationId,
  )
  const schoolMember = await database.schoolMembership.findUnique({
    where: { userId_schoolId: { userId: actorId, schoolId } },
  })
  if (!organizationAdmin && schoolMember?.role !== 'administrator') {
    throw new ParentServicePermissionError()
  }
}

export async function getParentPortalSetting(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
): Promise<{ parentPortalEnabled: boolean; enabledAt: Date | null }> {
  await requireSchoolAdministrator(database, actorId, schoolId)
  const access = await database.schoolServiceAccess.findUnique({
    where: { schoolId },
  })
  return {
    parentPortalEnabled: access?.parentPortalEnabled ?? false,
    enabledAt: access?.enabledAt ?? null,
  }
}

export async function setParentPortalEnabled(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  enabled: boolean,
): Promise<SchoolServiceAccess> {
  await requireSchoolAdministrator(database, actorId, schoolId)
  return database.$transaction(async (transaction) => {
    const setting = await transaction.schoolServiceAccess.upsert({
      where: { schoolId },
      create: {
        schoolId,
        parentPortalEnabled: enabled,
        enabledAt: enabled ? new Date() : null,
        updatedById: actorId,
      },
      update: {
        parentPortalEnabled: enabled,
        enabledAt: enabled ? new Date() : null,
        updatedById: actorId,
      },
    })
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'parentPortal.updated',
      resourceType: 'schoolServiceAccess',
      resourceId: schoolId,
      metadata: { enabled },
    })
    return setting
  })
}

export async function canAccessParentChild(
  database: PrismaClient,
  userId: string,
  schoolId: string,
  studentId: string,
): Promise<boolean> {
  const [link, setting] = await Promise.all([
    database.guardianAccess.findUnique({ where: { userId } }),
    database.schoolServiceAccess.findUnique({ where: { schoolId } }),
  ])
  if (!link || !setting?.parentPortalEnabled) return false
  return hasActiveVerifiedGuardianRelationship(
    database,
    schoolId,
    studentId,
    link.guardianId,
  )
}
