import { effectiveMembershipWhere } from './membershipPeriods.js'
import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { hasOrganizationAdminRole } from './organizationMemberships.js'
import { recordAuditEvent } from './auditEvents.js'

export class AcademicYearClosingPermissionError extends Error {
  constructor() {
    super('Academic year closing permission denied')
  }
}
export class AcademicYearClosingStateError extends Error {
  constructor() {
    super('Academic year cannot make this closing transition')
  }
}
export class AcademicYearClosingBlockedError extends Error {
  constructor(readonly blockers: YearClosingBlocker[]) {
    super('Academic year closing has blockers')
  }
}

export type YearClosingBlocker = {
  kind: 'pendingEnrollments' | 'unfinishedResults' | 'openDocumentRequests'
  count: number
}
export function closingBlockers(counts: {
  pendingEnrollments: number
  unfinishedResults: number
  openDocumentRequests: number
}): YearClosingBlocker[] {
  return (Object.entries(counts) as [YearClosingBlocker['kind'], number][])
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => ({ kind, count }))
}

export async function requireAcademicYearAdmin(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  z.uuid().parse(actorId)
  z.uuid().parse(schoolId)
  const school = await database.school.findUnique({
    where: { id: schoolId },
    select: { organizationId: true },
  })
  if (!school) throw new AcademicYearClosingPermissionError()
  if (await hasOrganizationAdminRole(database, actorId, school.organizationId))
    return
  const membership = await database.schoolMembership.findUnique({
    where: {
      ...effectiveMembershipWhere(),
      userId_schoolId: { userId: actorId, schoolId },
    },
  })
  if (membership?.role !== 'administrator')
    throw new AcademicYearClosingPermissionError()
}

async function readiness(
  database: Prisma.TransactionClient,
  schoolId: string,
  yearId: string,
) {
  const year = await database.academicYear.findFirst({
    where: { id: yearId, schoolId },
  })
  if (!year) throw new AcademicYearClosingPermissionError()
  const [pendingEnrollments, unfinishedResults, openDocumentRequests] =
    await Promise.all([
      database.enrollment.count({
        where: { schoolId, academicYearId: yearId, status: 'pending' },
      }),
      database.resultSet.count({
        where: {
          schoolId,
          academicYearId: yearId,
          status: { in: ['draft', 'pending'] },
        },
      }),
      database.documentRequest.count({
        where: {
          schoolId,
          academicYearId: yearId,
          status: { in: ['requested', 'processing'] },
        },
      }),
    ])
  return {
    year,
    blockers: closingBlockers({
      pendingEnrollments,
      unfinishedResults,
      openDocumentRequests,
    }),
  }
}
export async function getYearClosingReadiness(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  yearId: string,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  const result = await readiness(database, schoolId, z.uuid().parse(yearId))
  return {
    yearId,
    status: result.year.status,
    blockers: result.blockers,
    canClose: result.year.status === 'closing' && result.blockers.length === 0,
  }
}
export async function startAcademicYearClosing(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  yearId: string,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  z.uuid().parse(yearId)
  return database.$transaction(async (transaction) => {
    const changed = await transaction.academicYear.updateMany({
      where: { id: yearId, schoolId, status: 'active' },
      data: { status: 'closing', closingStartedAt: new Date() },
    })
    if (changed.count !== 1) throw new AcademicYearClosingStateError()
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'academicYear.closingStarted',
      resourceType: 'academicYear',
      resourceId: yearId,
    })
    return transaction.academicYear.findUniqueOrThrow({ where: { id: yearId } })
  })
}
export async function completeAcademicYearClosing(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
  yearId: string,
) {
  await requireAcademicYearAdmin(database, actorId, schoolId)
  z.uuid().parse(yearId)
  return database.$transaction(
    async (transaction) => {
      const result = await readiness(transaction, schoolId, yearId)
      if (result.year.status !== 'closing')
        throw new AcademicYearClosingStateError()
      if (result.blockers.length)
        throw new AcademicYearClosingBlockedError(result.blockers)
      const changed = await transaction.academicYear.updateMany({
        where: { id: yearId, schoolId, status: 'closing' },
        data: { status: 'closed', closedAt: new Date(), closedById: actorId },
      })
      if (changed.count !== 1) throw new AcademicYearClosingStateError()
      await recordAuditEvent(transaction, {
        schoolId,
        actorUserId: actorId,
        action: 'academicYear.closed',
        resourceType: 'academicYear',
        resourceId: yearId,
      })
      return transaction.academicYear.findUniqueOrThrow({
        where: { id: yearId },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
