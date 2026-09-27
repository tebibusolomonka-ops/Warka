import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'
import { recordEnrollmentHistory } from './enrollmentHistory.js'
import { effectiveMembershipWhere } from './membershipPeriods.js'

export class CorrectionPermissionError extends Error {
  constructor() {
    super('Correction access denied')
  }
}
export class CorrectionStateError extends Error {
  constructor() {
    super('Correction request no longer matches official state')
  }
}

async function role(
  database: Prisma.TransactionClient,
  actorUserId: string,
  schoolId: string,
  now: Date,
) {
  const school = await database.school.findUnique({ where: { id: schoolId } })
  const actor = await database.user.findUnique({
    where: { id: actorUserId },
    select: { accountStatus: true },
  })
  if (!school || actor?.accountStatus !== 'active')
    throw new CorrectionPermissionError()
  const [organization, membership] = await Promise.all([
    database.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: actorUserId,
          organizationId: school.organizationId,
        },
        ...effectiveMembershipWhere(now),
      },
    }),
    database.schoolMembership.findUnique({
      where: {
        userId_schoolId: { userId: actorUserId, schoolId },
        ...effectiveMembershipWhere(now),
      },
    }),
  ])
  return {
    organizationId: school.organizationId,
    role:
      organization?.role === 'owner' || organization?.role === 'administrator'
        ? ('administrator' as const)
        : (membership?.role ?? null),
  }
}

export async function reviewStudentCorrection(
  database: PrismaClient,
  actorUserId: string,
  schoolId: string,
  requestId: string,
  decision: 'approve' | 'reject' | 'cancel',
  reason?: string,
  now = new Date(),
) {
  z.uuid().parse(actorUserId)
  z.uuid().parse(schoolId)
  z.uuid().parse(requestId)
  const reviewedReason =
    decision === 'reject'
      ? z.string().trim().min(3).max(500).parse(reason)
      : null
  return database.$transaction(
    async (transaction) => {
      const access = await role(transaction, actorUserId, schoolId, now)
      const request = await transaction.studentCorrectionRequest.findFirst({
        where: { id: requestId, schoolId },
      })
      if (!request) throw new CorrectionPermissionError()
      if (decision === 'cancel') {
        if (
          request.requestedById !== actorUserId &&
          access.role !== 'administrator'
        )
          throw new CorrectionPermissionError()
      } else if (access.role !== 'administrator') {
        throw new CorrectionPermissionError()
      }
      if (request.status !== 'pending') throw new CorrectionStateError()
      if (decision === 'approve') {
        const student = await transaction.student.findFirst({
          where: { id: request.studentId, enrollments: { some: { schoolId } } },
        })
        if (!student) throw new CorrectionStateError()
        const current =
          request.field === 'dateOfBirth'
            ? (student.dateOfBirth?.toISOString().slice(0, 10) ?? null)
            : student[request.field]
        if (current !== request.previousValue) throw new CorrectionStateError()
        const value = request.proposedValue
        if (request.field === 'givenName') {
          if (!value) throw new CorrectionStateError()
          await transaction.student.update({
            where: { id: student.id },
            data: { givenName: value },
          })
        } else if (request.field === 'familyName') {
          await transaction.student.update({
            where: { id: student.id },
            data: { familyName: value },
          })
        } else {
          await transaction.student.update({
            where: { id: student.id },
            data: {
              dateOfBirth: value ? new Date(value + 'T00:00:00.000Z') : null,
            },
          })
        }
      }
      const status =
        decision === 'approve'
          ? 'approved'
          : decision === 'reject'
            ? 'rejected'
            : 'cancelled'
      const updated = await transaction.studentCorrectionRequest.update({
        where: { id: request.id },
        data: {
          status,
          reviewedAt: now,
          reviewedById: actorUserId,
          reviewReason: reviewedReason,
          effectiveAt: decision === 'approve' ? now : null,
        },
      })
      if (decision !== 'cancel')
        await recordAuditEvent(transaction, {
          organizationId: access.organizationId,
          schoolId,
          actorUserId,
          action:
            decision === 'approve'
              ? 'studentCorrection.approved'
              : 'studentCorrection.rejected',
          resourceType: 'studentCorrectionRequest',
          resourceId: request.id,
          metadata: { studentId: request.studentId, field: request.field },
        })
      return updated
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function reviewEnrollmentCorrection(
  database: PrismaClient,
  actorUserId: string,
  schoolId: string,
  requestId: string,
  decision: 'approve' | 'reject' | 'cancel',
  reason?: string,
  now = new Date(),
) {
  z.uuid().parse(actorUserId)
  z.uuid().parse(schoolId)
  z.uuid().parse(requestId)
  const reviewedReason =
    decision === 'reject'
      ? z.string().trim().min(3).max(500).parse(reason)
      : null
  return database.$transaction(
    async (transaction) => {
      const access = await role(transaction, actorUserId, schoolId, now)
      const request = await transaction.enrollmentCorrectionRequest.findFirst({
        where: { id: requestId, schoolId },
      })
      if (!request) throw new CorrectionPermissionError()
      if (decision === 'cancel') {
        if (
          request.requestedById !== actorUserId &&
          access.role !== 'administrator'
        )
          throw new CorrectionPermissionError()
      } else if (!['administrator', 'approver'].includes(access.role ?? '')) {
        throw new CorrectionPermissionError()
      }
      if (request.status !== 'pending') throw new CorrectionStateError()
      if (decision === 'approve') {
        const enrollment = await transaction.enrollment.findFirst({
          where: { id: request.enrollmentId, schoolId, status: 'approved' },
        })
        if (
          !enrollment ||
          enrollment.academicYearId !== request.academicYearId ||
          enrollment.gradeLevelId !== request.previousGradeLevelId ||
          enrollment.schoolClassId !== request.previousSchoolClassId
        )
          throw new CorrectionStateError()
        const grade = await transaction.gradeLevel.findFirst({
          where: { id: request.proposedGradeLevelId, schoolId },
        })
        const schoolClass = request.proposedSchoolClassId
          ? await transaction.schoolClass.findFirst({
              where: {
                id: request.proposedSchoolClassId,
                schoolId,
                academicYearId: enrollment.academicYearId,
                gradeLevelId: request.proposedGradeLevelId,
              },
            })
          : null
        if (!grade || (request.proposedSchoolClassId && !schoolClass))
          throw new CorrectionStateError()
        await transaction.enrollment.update({
          where: { id: enrollment.id },
          data: {
            gradeLevelId: request.proposedGradeLevelId,
            schoolClassId: request.proposedSchoolClassId,
          },
        })
        await recordEnrollmentHistory(transaction, {
          enrollmentId: enrollment.id,
          eventType:
            enrollment.gradeLevelId === request.proposedGradeLevelId
              ? 'classChanged'
              : 'gradeChanged',
          effectiveAt: now,
          performedById: actorUserId,
          reason: request.reason,
          previous: {
            academicYearId: enrollment.academicYearId,
            gradeLevelId: enrollment.gradeLevelId,
            schoolClassId: enrollment.schoolClassId,
          },
          next: {
            academicYearId: enrollment.academicYearId,
            gradeLevelId: request.proposedGradeLevelId,
            schoolClassId: request.proposedSchoolClassId,
          },
        })
      }
      const status =
        decision === 'approve'
          ? 'approved'
          : decision === 'reject'
            ? 'rejected'
            : 'cancelled'
      const updated = await transaction.enrollmentCorrectionRequest.update({
        where: { id: request.id },
        data: {
          status,
          reviewedAt: now,
          reviewedById: actorUserId,
          reviewReason: reviewedReason,
          effectiveAt: decision === 'approve' ? now : null,
        },
      })
      if (decision !== 'cancel')
        await recordAuditEvent(transaction, {
          organizationId: access.organizationId,
          schoolId,
          actorUserId,
          action:
            decision === 'approve'
              ? 'enrollmentCorrection.approved'
              : 'enrollmentCorrection.rejected',
          resourceType: 'enrollmentCorrectionRequest',
          resourceId: request.id,
          metadata: { enrollmentId: request.enrollmentId },
        })
      return updated
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function listCorrectionRequests(
  database: PrismaClient,
  actorUserId: string,
  schoolId: string,
  kind: 'student' | 'enrollment',
  input: {
    status?: 'pending' | 'approved' | 'rejected' | 'cancelled' | undefined
    studentId?: string | undefined
    enrollmentId?: string | undefined
    take?: number | undefined
    skip?: number | undefined
  },
) {
  z.uuid().parse(actorUserId)
  z.uuid().parse(schoolId)
  const take = z
    .number()
    .int()
    .min(1)
    .max(50)
    .parse(input.take ?? 25)
  const skip = z
    .number()
    .int()
    .min(0)
    .max(100000)
    .parse(input.skip ?? 0)
  const access = await role(database, actorUserId, schoolId, new Date())
  if (!['administrator', 'registrar', 'approver'].includes(access.role ?? ''))
    throw new CorrectionPermissionError()
  if (kind === 'student') {
    const where = {
      schoolId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.studentId
        ? { studentId: z.uuid().parse(input.studentId) }
        : {}),
    }
    return {
      total: await database.studentCorrectionRequest.count({ where }),
      items: await database.studentCorrectionRequest.findMany({
        where,
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
        take,
        skip,
        include: { requestedBy: { select: { id: true, displayName: true } } },
      }),
      take,
      skip,
    }
  }
  const where = {
    schoolId,
    ...(input.status ? { status: input.status } : {}),
    ...(input.enrollmentId
      ? { enrollmentId: z.uuid().parse(input.enrollmentId) }
      : {}),
  }
  return {
    total: await database.enrollmentCorrectionRequest.count({ where }),
    items: await database.enrollmentCorrectionRequest.findMany({
      where,
      orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
      include: { requestedBy: { select: { id: true, displayName: true } } },
    }),
    take,
    skip,
  }
}
