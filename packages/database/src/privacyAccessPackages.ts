import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'
import { effectiveMembershipWhere } from './membershipPeriods.js'
import {
  PrivacyPermissionError,
  privacyRequesterScope,
} from './privacyRequests.js'

export class PrivacyPackageStateError extends Error {
  constructor() {
    super('Privacy access package requires an approved request')
  }
}

export async function generatePrivacyAccessPackage(
  database: PrismaClient,
  actorUserId: string,
  requestId: string,
) {
  z.uuid().parse(actorUserId)
  z.uuid().parse(requestId)
  return database.$transaction(
    async (transaction) => {
      const request = await transaction.privacyRequest.findUnique({
        where: { id: requestId },
        include: { school: { select: { organizationId: true } } },
      })
      if (!request || request.type !== 'access')
        throw new PrivacyPermissionError()
      if (request.status !== 'approved') throw new PrivacyPackageStateError()
      const now = new Date()
      const [actor, organization, school] = await Promise.all([
        transaction.user.findUnique({
          where: { id: actorUserId },
          select: { accountStatus: true },
        }),
        transaction.organizationMembership.findUnique({
          where: {
            userId_organizationId: {
              userId: actorUserId,
              organizationId: request.school.organizationId,
            },
            ...effectiveMembershipWhere(now),
          },
        }),
        transaction.schoolMembership.findUnique({
          where: {
            userId_schoolId: {
              userId: actorUserId,
              schoolId: request.schoolId,
            },
            ...effectiveMembershipWhere(now),
          },
        }),
      ])
      if (
        actor?.accountStatus !== 'active' ||
        (!(
          organization && ['owner', 'administrator'].includes(organization.role)
        ) &&
          school?.role !== 'administrator')
      )
        throw new PrivacyPermissionError()
      const kind = await privacyRequesterScope(
        transaction,
        request.requesterUserId,
        request.studentId,
        request.schoolId,
      )
      if (kind !== request.requesterKind) throw new PrivacyPermissionError()
      const [student, enrollments, results, documents, account] =
        await Promise.all([
          transaction.student.findUnique({
            where: { id: request.studentId },
            select: {
              studentReference: true,
              givenName: true,
              familyName: true,
              dateOfBirth: true,
            },
          }),
          transaction.enrollment.findMany({
            where: {
              studentId: request.studentId,
              schoolId: request.schoolId,
              status: { in: ['approved', 'withdrawn'] },
            },
            select: {
              id: true,
              academicYearId: true,
              gradeLevelId: true,
              schoolClassId: true,
              status: true,
              approvedAt: true,
              withdrawnAt: true,
            },
            orderBy: { createdAt: 'asc' },
          }),
          transaction.publishedResult.findMany({
            where: {
              studentId: request.studentId,
              schoolId: request.schoolId,
              resultSet: { status: 'published' },
            },
            select: {
              currentPercentage: true,
              currentGradeLabel: true,
              resultSet: {
                select: {
                  publishedAt: true,
                  academicYear: { select: { name: true } },
                  gradingPeriod: { select: { name: true } },
                  subject: { select: { name: true } },
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          }),
          transaction.issuedDocument.findMany({
            where: { studentId: request.studentId, schoolId: request.schoolId },
            select: {
              id: true,
              documentType: true,
              status: true,
              issuedAt: true,
              academicYearId: true,
            },
            orderBy: { issuedAt: 'asc' },
          }),
          kind === 'student'
            ? transaction.user.findUnique({
                where: { id: request.requesterUserId },
                select: { displayName: true, email: true },
              })
            : transaction.guardianAccess.findUnique({
                where: { userId: request.requesterUserId },
                select: {
                  guardian: {
                    select: { name: true, email: true, phone: true },
                  },
                },
              }),
        ])
      if (!student) throw new PrivacyPermissionError()
      const data = {
        version: 1,
        student: {
          studentReference: student.studentReference,
          givenName: student.givenName,
          familyName: student.familyName,
          dateOfBirth: student.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        },
        enrollments: enrollments.map((item) => ({
          academicYearId: item.academicYearId,
          gradeLevelId: item.gradeLevelId,
          schoolClassId: item.schoolClassId,
          status: item.status,
          approvedAt: item.approvedAt?.toISOString() ?? null,
          withdrawnAt: item.withdrawnAt?.toISOString() ?? null,
        })),
        publishedResults: results.map((item) => ({
          academicYear: item.resultSet.academicYear.name,
          gradingPeriod: item.resultSet.gradingPeriod.name,
          subject: item.resultSet.subject.name,
          percentage: item.currentPercentage.toNumber(),
          grade: item.currentGradeLabel,
          publishedAt: item.resultSet.publishedAt?.toISOString() ?? null,
        })),
        issuedDocuments: documents.map((item) => ({
          id: item.id,
          documentType: item.documentType,
          status: item.status,
          issuedAt: item.issuedAt.toISOString(),
          academicYearId: item.academicYearId,
        })),
        requesterAccount:
          kind === 'student' && account && 'displayName' in account
            ? { displayName: account.displayName, email: account.email }
            : null,
        guardianRelationship:
          kind === 'guardian' && account && 'guardian' in account
            ? {
                name: account.guardian.name,
                email: account.guardian.email,
                phone: account.guardian.phone,
              }
            : null,
      }
      await transaction.privacyRequest.update({
        where: { id: requestId },
        data: { accessPackage: data as Prisma.InputJsonValue },
      })
      await recordAuditEvent(transaction, {
        organizationId: request.school.organizationId,
        schoolId: request.schoolId,
        actorUserId,
        action: 'privacyPackage.generated',
        resourceType: 'privacyRequest',
        resourceId: requestId,
        metadata: { requesterKind: kind, type: request.type },
      })
      return data
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
