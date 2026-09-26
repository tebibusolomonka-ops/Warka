import { z } from 'zod'
import type { PrismaClient, StudentGuardian } from '@prisma/client'
import { recordAuditEvent } from './auditEvents.js'
import { hasOrganizationAdminRole } from './organizationMemberships.js'

export class GuardianRelationshipPermissionError extends Error {
  constructor() {
    super('Guardian relationship is not available in this school')
  }
}

export class GuardianRelationshipStateError extends Error {
  constructor() {
    super('Guardian relationship cannot change from its current state')
  }
}

const RevocationReasonSchema = z.string().trim().min(1).max(500)

async function requireRelationshipAuthority(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  studentId: string,
  guardianId: string,
) {
  const day = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')
  const [school, enrollment, relationship] = await Promise.all([
    database.school.findUnique({ where: { id: schoolId } }),
    database.enrollment.findFirst({
      where: {
        schoolId,
        studentId,
        status: 'approved',
        academicYear: { startsOn: { lte: day }, endsOn: { gte: day } },
      },
    }),
    database.studentGuardian.findUnique({
      where: { studentId_guardianId: { studentId, guardianId } },
    }),
  ])
  if (!school || !enrollment || !relationship) {
    throw new GuardianRelationshipPermissionError()
  }
  const organizationAdmin = await hasOrganizationAdminRole(
    database,
    actorId,
    school.organizationId,
  )
  const schoolMembership = await database.schoolMembership.findUnique({
    where: { userId_schoolId: { userId: actorId, schoolId } },
  })
  if (
    !organizationAdmin &&
    schoolMembership?.role !== 'administrator' &&
    schoolMembership?.role !== 'registrar'
  ) {
    throw new GuardianRelationshipPermissionError()
  }
  return relationship
}

export async function verifyGuardianRelationship(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  studentId: string,
  guardianId: string,
): Promise<StudentGuardian> {
  const relationship = await requireRelationshipAuthority(
    database,
    actorId,
    schoolId,
    studentId,
    guardianId,
  )
  if (
    relationship.verificationStatus === 'verified' &&
    relationship.verificationSchoolId === schoolId
  ) {
    throw new GuardianRelationshipStateError()
  }
  return database.$transaction(async (transaction) => {
    const updated = await transaction.studentGuardian.update({
      where: { studentId_guardianId: { studentId, guardianId } },
      data: {
        verificationStatus: 'verified',
        verificationSchoolId: schoolId,
        verifiedAt: new Date(),
        verifiedById: actorId,
        revokedAt: null,
        revokedById: null,
        revocationReason: null,
      },
    })
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'guardianRelationship.verified',
      resourceType: 'guardian',
      resourceId: guardianId,
      metadata: { studentId },
    })
    return updated
  })
}

export async function revokeGuardianRelationship(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  studentId: string,
  guardianId: string,
  reason: string,
): Promise<StudentGuardian> {
  const relationship = await requireRelationshipAuthority(
    database,
    actorId,
    schoolId,
    studentId,
    guardianId,
  )
  if (
    relationship.verificationStatus !== 'verified' ||
    relationship.verificationSchoolId !== schoolId
  ) {
    throw new GuardianRelationshipStateError()
  }
  const revocationReason = RevocationReasonSchema.parse(reason)
  return database.$transaction(async (transaction) => {
    const updated = await transaction.studentGuardian.update({
      where: { studentId_guardianId: { studentId, guardianId } },
      data: {
        verificationStatus: 'revoked',
        revokedAt: new Date(),
        revokedById: actorId,
        revocationReason,
      },
    })
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'guardianRelationship.revoked',
      resourceType: 'guardian',
      resourceId: guardianId,
      metadata: { studentId },
    })
    return updated
  })
}

export async function hasActiveVerifiedGuardianRelationship(
  database: PrismaClient,
  schoolId: string,
  studentId: string,
  guardianId: string,
): Promise<boolean> {
  const day = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')
  const [relationship, enrollment] = await Promise.all([
    database.studentGuardian.findUnique({
      where: { studentId_guardianId: { studentId, guardianId } },
    }),
    database.enrollment.findFirst({
      where: {
        schoolId,
        studentId,
        status: 'approved',
        academicYear: { startsOn: { lte: day }, endsOn: { gte: day } },
      },
    }),
  ])
  return !!(
    relationship &&
    enrollment &&
    relationship.verificationStatus === 'verified' &&
    relationship.verificationSchoolId === schoolId
  )
}
