import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'
import { PrivacyPermissionError } from './privacyRequests.js'
import { requirePrivacyReviewer } from './privacyReviewAccess.js'

export class ProcessingRestrictionStateError extends Error {
  constructor() {
    super('Processing restriction state does not permit this action')
  }
}

export async function applyProcessingRestriction(
  database: PrismaClient,
  actorUserId: string,
  requestId: string,
  now = new Date(),
) {
  z.uuid().parse(actorUserId)
  z.uuid().parse(requestId)
  return database.$transaction(
    async (transaction) => {
      const request = await transaction.privacyRequest.findUnique({
        where: { id: requestId },
      })
      if (
        !request ||
        request.type !== 'restriction' ||
        !request.restrictionCategory
      )
        throw new PrivacyPermissionError()
      const access = await requirePrivacyReviewer(
        transaction,
        actorUserId,
        request.schoolId,
        now,
      )
      if (request.status !== 'approved')
        throw new ProcessingRestrictionStateError()
      const existing = await transaction.processingRestriction.findUnique({
        where: {
          privacyRequestId_category: {
            privacyRequestId: requestId,
            category: request.restrictionCategory,
          },
        },
      })
      if (existing) return existing
      if (request.restrictionCategory === 'parentPortalSharing') {
        const active = await transaction.processingRestriction.findFirst({
          where: {
            schoolId: request.schoolId,
            studentId: request.studentId,
            category: 'parentPortalSharing',
            status: 'active',
          },
        })
        if (active) throw new ProcessingRestrictionStateError()
      }
      const enforced = request.restrictionCategory === 'parentPortalSharing'
      const restriction = await transaction.processingRestriction.create({
        data: {
          schoolId: request.schoolId,
          studentId: request.studentId,
          privacyRequestId: requestId,
          category: request.restrictionCategory,
          status: enforced ? 'active' : 'reviewRequired',
          effectiveAt: enforced ? now : null,
          approvedById: actorUserId,
        },
      })
      await recordAuditEvent(transaction, {
        organizationId: access.organizationId,
        schoolId: request.schoolId,
        actorUserId,
        action: 'processingRestriction.applied',
        resourceType: 'processingRestriction',
        resourceId: restriction.id,
        metadata: {
          category: restriction.category,
          status: restriction.status,
        },
      })
      return restriction
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function endProcessingRestriction(
  database: PrismaClient,
  actorUserId: string,
  restrictionId: string,
  now = new Date(),
) {
  z.uuid().parse(actorUserId)
  z.uuid().parse(restrictionId)
  return database.$transaction(
    async (transaction) => {
      const restriction = await transaction.processingRestriction.findUnique({
        where: { id: restrictionId },
      })
      if (!restriction) throw new PrivacyPermissionError()
      const access = await requirePrivacyReviewer(
        transaction,
        actorUserId,
        restriction.schoolId,
        now,
      )
      if (restriction.status !== 'active')
        throw new ProcessingRestrictionStateError()
      const updated = await transaction.processingRestriction.update({
        where: { id: restrictionId },
        data: { status: 'ended', endedAt: now, endedById: actorUserId },
      })
      await recordAuditEvent(transaction, {
        organizationId: access.organizationId,
        schoolId: restriction.schoolId,
        actorUserId,
        action: 'processingRestriction.ended',
        resourceType: 'processingRestriction',
        resourceId: restrictionId,
        metadata: { category: restriction.category },
      })
      return updated
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function isParentPortalSharingRestricted(
  database: Pick<PrismaClient, 'processingRestriction'>,
  schoolId: string,
  studentId: string,
) {
  return !!(await database.processingRestriction.findFirst({
    where: {
      schoolId,
      studentId,
      category: 'parentPortalSharing',
      status: 'active',
    },
    select: { id: true },
  }))
}
