import { effectiveMembershipWhere } from './membershipPeriods.js'
import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'
import { createNotifications } from './notifications.js'
import { requireBureauPermission } from './bureauAccess.js'
import { evaluateReportingReadiness } from './reportingValidation.js'
import { createReportingSnapshotEvidence } from './reportingSnapshotEvidence.js'

export class ReportingSubmissionError extends Error {}

type SubmissionStore = Pick<
  PrismaClient,
  | '$transaction'
  | 'auditEvent'
  | 'bureauAccess'
  | 'reportingPeriod'
  | 'reportingRequirement'
  | 'reportingSubmission'
  | 'reportingSubmissionVersion'
  | 'schoolMembership'
  | 'notification'
  | 'dataQualityIssue'
>

async function requireSchoolSubmitter(
  database: SubmissionStore,
  userId: string,
  schoolId: string,
) {
  const membership = await database.schoolMembership.findUnique({
    where: {
      ...effectiveMembershipWhere(),
      userId_schoolId: { userId, schoolId },
    },
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
  const existing = await database.reportingSubmission.findUnique({
    where: { reportingPeriodId_schoolId: { reportingPeriodId, schoolId } },
  })
  if (!existing)
    return database.reportingSubmission.create({
      data: { reportingPeriodId, schoolId, snapshot },
    })
  const changed = await database.reportingSubmission.updateMany({
    where: { id: existing.id, status: { in: ['draft', 'returned'] } },
    data: { snapshot },
  })
  if (changed.count !== 1)
    throw new ReportingSubmissionError('Submitted reports cannot be edited')
  return database.reportingSubmission.findUniqueOrThrow({
    where: { id: existing.id },
  })
}

export async function submitSchoolReport(
  database: SubmissionStore,
  actorUserId: string,
  reportingPeriodId: string,
  schoolId: string,
) {
  return submitVersion(database, actorUserId, reportingPeriodId, schoolId)
}

export async function resubmitSchoolReport(
  database: SubmissionStore,
  actorUserId: string,
  reportingPeriodId: string,
  schoolId: string,
  reason: string,
) {
  return submitVersion(
    database,
    actorUserId,
    reportingPeriodId,
    schoolId,
    z.string().trim().min(3).max(500).parse(reason),
  )
}

async function submitVersion(
  database: SubmissionStore,
  actorUserId: string,
  reportingPeriodId: string,
  schoolId: string,
  resubmissionReason?: string,
) {
  await requireSchoolSubmitter(database, actorUserId, schoolId)
  return database.$transaction(async (transaction) => {
    const readiness = await evaluateReportingReadiness(
      transaction as PrismaClient,
      reportingPeriodId,
      schoolId,
    )
    if (!readiness.ready)
      throw new ReportingSubmissionError(
        `Report is not ready: ${readiness.blocking.join(', ')}`,
      )
    const period = await transaction.reportingPeriod.findUniqueOrThrow({
      where: { id: reportingPeriodId },
    })
    if (period.status !== 'open')
      throw new ReportingSubmissionError('Reporting period is not open')
    const changed = await transaction.reportingSubmission.updateMany({
      where: {
        reportingPeriodId,
        schoolId,
        status: resubmissionReason ? 'returned' : 'draft',
      },
      data: {
        status: 'submitted',
        currentVersion: { increment: 1 },
        submittedAt: new Date(),
        submittedById: actorUserId,
      },
    })
    if (changed.count !== 1)
      throw new ReportingSubmissionError(
        'Report is not available for submission',
      )
    const submission = await transaction.reportingSubmission.findUniqueOrThrow({
      where: { reportingPeriodId_schoolId: { reportingPeriodId, schoolId } },
    })
    const evidence = createReportingSnapshotEvidence(submission.snapshot)
    await transaction.reportingSubmissionVersion.create({
      data: {
        submissionId: submission.id,
        version: submission.currentVersion,
        snapshot: evidence.snapshot,
        snapshotChecksum: evidence.checksum,
        validationSummary: {
          warnings: readiness.warnings,
          blocking: readiness.blocking,
        },
        resubmissionReason: resubmissionReason ?? null,
        status: 'submitted',
        submittedAt: submission.submittedAt!,
        submittedById: actorUserId,
      },
    })
    await recordAuditEvent(transaction, {
      organizationId: period.organizationId,
      schoolId,
      actorUserId,
      action: resubmissionReason ? 'report.resubmitted' : 'report.submitted',
      resourceType: 'reportingSubmission',
      resourceId: submission.id,
      metadata: { reportingPeriodId, version: submission.currentVersion },
    })
    return submission
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
  if (!['submitted', 'underReview'].includes(submission.status))
    throw new ReportingSubmissionError('Only submitted reports may be approved')
  if (submission.currentVersion < 1)
    throw new ReportingSubmissionError('Submitted version is missing')
  return database.$transaction(async (transaction) => {
    const changed = await transaction.reportingSubmission.updateMany({
      where: { id: submissionId, status: { in: ['submitted', 'underReview'] } },
      data: {
        status: 'approved',
        acceptedVersion: submission.currentVersion,
        approvedAt: new Date(),
        approvedById: actorUserId,
      },
    })
    if (changed.count !== 1)
      throw new ReportingSubmissionError('Report review state changed')
    const updated = await transaction.reportingSubmission.findUniqueOrThrow({
      where: { id: submissionId },
    })
    await recordAuditEvent(transaction, {
      organizationId: submission.reportingPeriod.organizationId,
      schoolId: submission.schoolId,
      actorUserId,
      action: 'report.approved',
      resourceType: 'reportingSubmission',
      resourceId: submissionId,
    })
    const recipients = await transaction.schoolMembership.findMany({
      where: {
        schoolId: submission.schoolId,
        role: { in: ['administrator', 'registrar'] },
        ...effectiveMembershipWhere(),
      },
      select: { userId: true },
    })
    await createNotifications(
      transaction,
      recipients.map((member) => member.userId),
      {
        type:
          updated.status === 'returned' ? 'report.returned' : 'report.approved',
        title:
          updated.status === 'returned' ? 'Report returned' : 'Report approved',
        message:
          updated.status === 'returned'
            ? 'A school report needs revision.'
            : 'A school report was approved.',
        resourceType: 'reportingSubmission',
        resourceId: submissionId,
      },
    )
    return updated
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
  if (!['submitted', 'underReview'].includes(submission.status))
    throw new ReportingSubmissionError('Only submitted reports may be returned')
  return database.$transaction(async (transaction) => {
    const changed = await transaction.reportingSubmission.updateMany({
      where: { id: submissionId, status: { in: ['submitted', 'underReview'] } },
      data: {
        status: 'returned',
        returnedAt: new Date(),
        returnedById: actorUserId,
        returnReason,
      },
    })
    if (changed.count !== 1)
      throw new ReportingSubmissionError('Report review state changed')
    const updated = await transaction.reportingSubmission.findUniqueOrThrow({
      where: { id: submissionId },
    })
    await recordAuditEvent(transaction, {
      organizationId: submission.reportingPeriod.organizationId,
      schoolId: submission.schoolId,
      actorUserId,
      action: 'report.returned',
      resourceType: 'reportingSubmission',
      resourceId: submissionId,
    })
    const recipients = await transaction.schoolMembership.findMany({
      where: {
        schoolId: submission.schoolId,
        role: { in: ['administrator', 'registrar'] },
        ...effectiveMembershipWhere(),
      },
      select: { userId: true },
    })
    await createNotifications(
      transaction,
      recipients.map((member) => member.userId),
      {
        type:
          updated.status === 'returned' ? 'report.returned' : 'report.approved',
        title:
          updated.status === 'returned' ? 'Report returned' : 'Report approved',
        message:
          updated.status === 'returned'
            ? 'A school report needs revision.'
            : 'A school report was approved.',
        resourceType: 'reportingSubmission',
        resourceId: submissionId,
      },
    )
    return updated
  })
}

export async function startSchoolReportReview(
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
  const changed = await database.reportingSubmission.updateMany({
    where: { id: submissionId, status: 'submitted' },
    data: { status: 'underReview' },
  })
  if (changed.count !== 1)
    throw new ReportingSubmissionError(
      'Only submitted reports may enter review',
    )
  await recordAuditEvent(database, {
    organizationId: submission.reportingPeriod.organizationId,
    schoolId: submission.schoolId,
    actorUserId,
    action: 'report.reviewStarted',
    resourceType: 'reportingSubmission',
    resourceId: submissionId,
  })
  return database.reportingSubmission.findUniqueOrThrow({
    where: { id: submissionId },
  })
}
