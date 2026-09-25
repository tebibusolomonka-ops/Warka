import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireBureauPermission } from './bureauAccess.js'

export class ReportingSubmissionError extends Error {}

type SubmissionStore = Pick<
  PrismaClient,
  | 'bureauAccess'
  | 'reportingPeriod'
  | 'reportingRequirement'
  | 'reportingSubmission'
  | 'schoolMembership'
>

async function requireSchoolSubmitter(
  database: SubmissionStore,
  userId: string,
  schoolId: string,
) {
  const membership = await database.schoolMembership.findUnique({
    where: { userId_schoolId: { userId, schoolId } },
  })
  if (!membership || !['administrator', 'registrar'].includes(membership.role))
    throw new ReportingSubmissionError('School reporting permission denied')
}

export async function prepareSchoolReport(
  database: SubmissionStore,
  actorUserId: string,
  reportingPeriodId: string,
  schoolId: string,
  snapshot: Prisma.InputJsonValue,
) {
  await requireSchoolSubmitter(database, actorUserId, schoolId)
  const requirement = await database.reportingRequirement.findUnique({
    where: { reportingPeriodId_schoolId: { reportingPeriodId, schoolId } },
    include: { reportingPeriod: true },
  })
  if (!requirement || requirement.reportingPeriod.status !== 'open')
    throw new ReportingSubmissionError('School is not open for this report')
  return database.reportingSubmission.upsert({
    where: { reportingPeriodId_schoolId: { reportingPeriodId, schoolId } },
    create: { reportingPeriodId, schoolId, snapshot },
    update: { snapshot, status: 'draft', returnReason: null },
  })
}

export async function submitSchoolReport(
  database: SubmissionStore,
  actorUserId: string,
  reportingPeriodId: string,
  schoolId: string,
) {
  await requireSchoolSubmitter(database, actorUserId, schoolId)
  const period = await database.reportingPeriod.findUniqueOrThrow({
    where: { id: reportingPeriodId },
  })
  if (period.status !== 'open')
    throw new ReportingSubmissionError('Reporting period is not open')
  return database.reportingSubmission.update({
    where: { reportingPeriodId_schoolId: { reportingPeriodId, schoolId } },
    data: {
      status: 'submitted',
      submittedAt: new Date(),
      submittedById: actorUserId,
    },
  })
}

export async function approveSchoolReport(
  database: SubmissionStore,
  actorUserId: string,
  submissionId: string,
) {
  const submission = await database.reportingSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { reportingPeriod: true },
  })
  await requireBureauPermission(
    database,
    actorUserId,
    submission.reportingPeriod.organizationId,
    'manage',
  )
  if (submission.status !== 'submitted')
    throw new ReportingSubmissionError('Only submitted reports may be approved')
  return database.reportingSubmission.update({
    where: { id: submissionId },
    data: {
      status: 'approved',
      approvedAt: new Date(),
      approvedById: actorUserId,
    },
  })
}

export async function returnSchoolReport(
  database: SubmissionStore,
  actorUserId: string,
  submissionId: string,
  reason: string,
) {
  const returnReason = z.string().trim().min(3).max(500).parse(reason)
  const submission = await database.reportingSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { reportingPeriod: true },
  })
  await requireBureauPermission(
    database,
    actorUserId,
    submission.reportingPeriod.organizationId,
    'manage',
  )
  if (submission.status !== 'submitted')
    throw new ReportingSubmissionError('Only submitted reports may be returned')
  return database.reportingSubmission.update({
    where: { id: submissionId },
    data: {
      status: 'returned',
      returnedAt: new Date(),
      returnedById: actorUserId,
      returnReason,
    },
  })
}
