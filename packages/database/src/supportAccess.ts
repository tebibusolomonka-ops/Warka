import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'
import { hasOrganizationAdminRole } from './organizationMemberships.js'

const maximumGrantDuration = 24 * 60 * 60 * 1000
const SupportReasonSchema = z.string().trim().min(5).max(500)

export class SupportAccessPermissionError extends Error {
  constructor() {
    super('Support access permission denied')
  }
}

export class SupportAccessStateError extends Error {
  constructor(message = 'Support access cannot change from its current state') {
    super(message)
  }
}

export class SupportAccessDeniedError extends Error {
  constructor() {
    super('Active support access is required')
  }
}

async function requireSchoolAdministrator(
  database: PrismaClient,
  actorUserId: string,
  schoolId: string,
) {
  const school = await database.school.findUnique({ where: { id: schoolId } })
  if (!school) throw new SupportAccessPermissionError()
  const [organizationAdministrator, membership] = await Promise.all([
    hasOrganizationAdminRole(database, actorUserId, school.organizationId),
    database.schoolMembership.findUnique({
      where: { userId_schoolId: { userId: actorUserId, schoolId } },
    }),
  ])
  if (!organizationAdministrator && membership?.role !== 'administrator')
    throw new SupportAccessPermissionError()
  return school
}

export async function createSupportIdentity(
  database: PrismaClient,
  userId: string,
) {
  z.uuid().parse(userId)
  await database.user.findUniqueOrThrow({ where: { id: userId } })
  return database.supportIdentity.create({ data: { userId } })
}

export async function listSupportIdentities(
  database: PrismaClient,
  actorUserId: string,
  schoolId: string,
) {
  await requireSchoolAdministrator(database, actorUserId, schoolId)
  return database.user.findMany({
    where: { supportIdentity: { isNot: null } },
    select: { id: true, displayName: true, email: true },
    orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
  })
}

export async function requestSupportAccess(
  database: PrismaClient,
  actorUserId: string,
  input: {
    supportUserId: string
    schoolId: string
    reason: string
    expiresAt: Date | string
  },
) {
  const supportUserId = z.uuid().parse(input.supportUserId)
  const schoolId = z.uuid().parse(input.schoolId)
  const reason = SupportReasonSchema.parse(input.reason)
  const expiresAt = z.coerce.date().parse(input.expiresAt)
  const requestedAt = new Date()
  if (
    expiresAt <= requestedAt ||
    expiresAt.getTime() - requestedAt.getTime() > maximumGrantDuration
  )
    throw new SupportAccessStateError(
      'Support access must expire within 24 hours',
    )
  const [identity, school] = await Promise.all([
    database.supportIdentity.findUnique({ where: { userId: supportUserId } }),
    database.school.findUnique({ where: { id: schoolId } }),
  ])
  if (!identity || !school) throw new SupportAccessPermissionError()
  if (actorUserId !== supportUserId)
    await requireSchoolAdministrator(database, actorUserId, schoolId)
  return database.$transaction(async (transaction) => {
    const grant = await transaction.supportAccessGrant.create({
      data: {
        supportUserId,
        schoolId,
        reason,
        requestedAt,
        requestedById: actorUserId,
        expiresAt,
      },
    })
    await recordAuditEvent(transaction, {
      organizationId: school.organizationId,
      schoolId,
      actorUserId,
      action: 'supportAccess.requested',
      resourceType: 'supportAccessGrant',
      resourceId: grant.id,
      metadata: {
        scope: grant.scope,
        expiresAt: expiresAt.toISOString(),
        supportUserId,
      },
    })
    return grant
  })
}

export async function approveSupportAccess(
  database: PrismaClient,
  actorUserId: string,
  grantId: string,
) {
  const grant = await database.supportAccessGrant.findUniqueOrThrow({
    where: { id: z.uuid().parse(grantId) },
  })
  const school = await requireSchoolAdministrator(
    database,
    actorUserId,
    grant.schoolId,
  )
  const approvedAt = new Date()
  if (grant.status !== 'pending' || grant.expiresAt <= approvedAt)
    throw new SupportAccessStateError()
  return database.$transaction(async (transaction) => {
    const changed = await transaction.supportAccessGrant.updateMany({
      where: { id: grant.id, status: 'pending', expiresAt: { gt: approvedAt } },
      data: { status: 'approved', approvedAt, approvedById: actorUserId },
    })
    if (changed.count !== 1) throw new SupportAccessStateError()
    const approved = await transaction.supportAccessGrant.findUniqueOrThrow({
      where: { id: grant.id },
    })
    await recordAuditEvent(transaction, {
      organizationId: school.organizationId,
      schoolId: grant.schoolId,
      actorUserId,
      action: 'supportAccess.approved',
      resourceType: 'supportAccessGrant',
      resourceId: grant.id,
      metadata: { supportUserId: grant.supportUserId },
    })
    return approved
  })
}

export async function revokeSupportAccess(
  database: PrismaClient,
  actorUserId: string,
  grantId: string,
) {
  const grant = await database.supportAccessGrant.findUniqueOrThrow({
    where: { id: z.uuid().parse(grantId) },
  })
  const school =
    actorUserId === grant.supportUserId
      ? await database.school.findUniqueOrThrow({
          where: { id: grant.schoolId },
        })
      : await requireSchoolAdministrator(database, actorUserId, grant.schoolId)
  if (grant.status === 'revoked') throw new SupportAccessStateError()
  const revokedAt = new Date()
  return database.$transaction(async (transaction) => {
    const changed = await transaction.supportAccessGrant.updateMany({
      where: { id: grant.id, status: { in: ['pending', 'approved'] } },
      data: { status: 'revoked', revokedAt, revokedById: actorUserId },
    })
    if (changed.count !== 1) throw new SupportAccessStateError()
    const revoked = await transaction.supportAccessGrant.findUniqueOrThrow({
      where: { id: grant.id },
    })
    await recordAuditEvent(transaction, {
      organizationId: school.organizationId,
      schoolId: grant.schoolId,
      actorUserId,
      action: 'supportAccess.revoked',
      resourceType: 'supportAccessGrant',
      resourceId: grant.id,
      metadata: { supportUserId: grant.supportUserId },
    })
    return revoked
  })
}

export async function checkSupportAccess(
  database: PrismaClient,
  supportUserId: string,
  schoolId: string,
  scope: 'schoolAdministrationDiagnostics' = 'schoolAdministrationDiagnostics',
) {
  const grant = await database.supportAccessGrant.findFirst({
    where: {
      supportUserId,
      schoolId,
      scope,
      status: 'approved',
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
  })
  if (!grant) throw new SupportAccessDeniedError()
  return grant
}

export async function listSupportAccessGrants(
  database: PrismaClient,
  actorUserId: string,
  schoolId: string,
) {
  await requireSchoolAdministrator(database, actorUserId, schoolId)
  return database.supportAccessGrant.findMany({
    where: { schoolId },
    orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
    take: 100,
  })
}

export type { SupportAccessGrant, SupportIdentity } from '@prisma/client'
