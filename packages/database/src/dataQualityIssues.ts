import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { findSchoolMembership } from './schoolMemberships.js'
import { recordAuditEvent } from './auditEvents.js'

export class DataQualityIssueAccessError extends Error {}
export class DataQualityIssueStateError extends Error {}

export const DismissDataQualityIssueSchema = z.strictObject({
  schoolId: z.uuid(),
  issueId: z.uuid(),
  reason: z
    .string()
    .trim()
    .min(3)
    .max(500)
    .refine((value) => !/[<>]/.test(value)),
})

export async function requireDataQualityAdministrator(
  database: PrismaClient,
  actorId: string,
  schoolId: string,
) {
  const membership = await findSchoolMembership(database, actorId, schoolId)
  if (membership?.role !== 'administrator')
    throw new DataQualityIssueAccessError(
      'School data quality administration required',
    )
}

export async function dismissDataQualityIssue(
  database: PrismaClient,
  actorId: string,
  input: z.input<typeof DismissDataQualityIssueSchema>,
) {
  const { schoolId, issueId, reason } =
    DismissDataQualityIssueSchema.parse(input)
  await requireDataQualityAdministrator(database, actorId, schoolId)
  return database.$transaction(async (transaction) => {
    const issue = await transaction.dataQualityIssue.findFirst({
      where: { id: issueId, schoolId },
    })
    if (!issue) throw new DataQualityIssueAccessError('Issue unavailable')
    if (issue.status !== 'open' || issue.severity === 'blocking')
      throw new DataQualityIssueStateError(
        'Only open non-blocking issues may be dismissed',
      )
    const changed = await transaction.dataQualityIssue.updateMany({
      where: {
        id: issueId,
        schoolId,
        status: 'open',
        severity: { not: 'blocking' },
      },
      data: {
        status: 'dismissed',
        dismissedAt: new Date(),
        dismissedById: actorId,
        dismissalReason: reason,
      },
    })
    if (changed.count !== 1)
      throw new DataQualityIssueStateError('Issue state changed')
    await recordAuditEvent(transaction, {
      schoolId,
      actorUserId: actorId,
      action: 'dataQualityIssue.dismissed',
      resourceType: 'dataQualityIssue',
      resourceId: issueId,
      metadata: { code: issue.code },
    })
    return transaction.dataQualityIssue.findUniqueOrThrow({
      where: { id: issueId },
    })
  })
}
