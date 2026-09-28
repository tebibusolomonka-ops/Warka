import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'
import { assertMarkEntryWindow } from './markEntryWindows.js'
import { MarkModerationStateError } from './markModerationRequests.js'
import { hasOrganizationAdminRole } from './organizationMemberships.js'
import { assertResultSetDraft } from './results.js'
import { findSchoolMembership } from './schoolMemberships.js'

export async function reviewMarkModeration(
  database: PrismaClient,
  reviewerId: string,
  schoolId: string,
  requestId: string,
  decision: 'approved' | 'rejected',
) {
  for (const id of [reviewerId, schoolId, requestId]) z.uuid().parse(id)
  return database.$transaction(
    async (transaction) => {
      const request = await transaction.markModerationRequest.findFirst({
        where: { id: requestId, schoolId, status: 'pending' },
        include: { mark: { include: { assessment: true } } },
      })
      if (!request)
        throw new MarkModerationStateError('Pending moderation required')
      if (request.requestedById === reviewerId)
        throw new MarkModerationStateError(
          'Requester cannot review own moderation',
        )
      const school = await transaction.school.findUnique({
        where: { id: schoolId },
        select: { organizationId: true },
      })
      const membership = await findSchoolMembership(
        transaction as PrismaClient,
        reviewerId,
        schoolId,
      )
      if (
        !school ||
        (!(await hasOrganizationAdminRole(
          transaction as PrismaClient,
          reviewerId,
          school.organizationId,
        )) &&
          membership?.role !== 'administrator' &&
          membership?.role !== 'approver')
      ) {
        throw new MarkModerationStateError('Academic reviewer required')
      }
      if (decision === 'approved') {
        await assertResultSetDraft(
          transaction as PrismaClient,
          request.mark.assessment,
        )
        if (!request.mark.score.eq(request.originalScore)) {
          throw new MarkModerationStateError(
            'Original mark changed since request',
          )
        }
        const window = await transaction.markEntryWindow.findUnique({
          where: { assessmentId: request.mark.assessmentId },
        })
        const now = new Date()
        const windowClosed = Boolean(
          window &&
          (window.status !== 'open' ||
            window.opensAt > now ||
            window.closesAt <= now),
        )
        if (windowClosed)
          await assertMarkEntryWindow(
            transaction as PrismaClient,
            reviewerId,
            request.mark.assessment,
            request.reason,
            now,
          )
        const changed = await transaction.mark.updateMany({
          where: { id: request.markId, schoolId, score: request.originalScore },
          data: { score: request.proposedScore, recordedById: reviewerId },
        })
        if (changed.count !== 1)
          throw new MarkModerationStateError(
            'Original mark changed since request',
          )
        await transaction.markCorrection.create({
          data: {
            schoolId,
            markId: request.markId,
            moderationRequestId: request.id,
            previousScore: request.originalScore,
            newScore: request.proposedScore,
            reviewerId,
            reason: request.reason,
          },
        })
        if (windowClosed)
          await recordAuditEvent(transaction, {
            schoolId,
            actorUserId: reviewerId,
            action: 'mark.windowOverridden',
            resourceType: 'mark',
            resourceId: request.markId,
            metadata: { reason: request.reason },
          })
      }
      const changedRequest = await transaction.markModerationRequest.updateMany(
        {
          where: { id: requestId, schoolId, status: 'pending' },
          data: {
            status: decision,
            reviewedById: reviewerId,
            reviewedAt: new Date(),
          },
        },
      )
      if (changedRequest.count !== 1)
        throw new MarkModerationStateError('Moderation state changed')
      await recordAuditEvent(transaction, {
        schoolId,
        actorUserId: reviewerId,
        action:
          decision === 'approved'
            ? 'mark.moderated'
            : 'mark.moderationRejected',
        resourceType: 'mark',
        resourceId: request.markId,
        metadata: { requestId },
      })
      return transaction.markModerationRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: { correction: true },
      })
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
