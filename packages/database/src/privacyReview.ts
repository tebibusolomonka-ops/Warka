import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'
import { generatePrivacyAccessPackage } from './privacyAccessPackages.js'
import { routePrivacyCorrection } from './privacyCorrectionRouting.js'
import { PrivacyPermissionError } from './privacyRequests.js'
import { requirePrivacyReviewer } from './privacyReviewAccess.js'
import { applyProcessingRestriction } from './processingRestrictions.js'

export class PrivacyReviewStateError extends Error {
  constructor() {
    super('Privacy request state does not permit this action')
  }
}

export async function reviewPrivacyRequest(
  database: PrismaClient,
  actorUserId: string,
  requestId: string,
  decision: 'review' | 'approve' | 'reject',
  reason?: string,
  now = new Date(),
) {
  z.uuid().parse(actorUserId)
  z.uuid().parse(requestId)
  const reviewReason =
    decision === 'reject'
      ? z.string().trim().min(3).max(500).parse(reason)
      : null
  const request = await database.$transaction(
    async (transaction) => {
      const current = await transaction.privacyRequest.findUnique({
        where: { id: requestId },
      })
      if (!current) throw new PrivacyPermissionError()
      const access = await requirePrivacyReviewer(
        transaction,
        actorUserId,
        current.schoolId,
        now,
      )
      if (current.requesterUserId === actorUserId)
        throw new PrivacyPermissionError()
      if (
        (decision === 'review' && current.status !== 'submitted') ||
        (decision !== 'review' &&
          !['submitted', 'underReview'].includes(current.status))
      ) {
        if (decision === 'approve' && current.status === 'approved')
          return current
        throw new PrivacyReviewStateError()
      }
      const status =
        decision === 'review'
          ? 'underReview'
          : decision === 'approve'
            ? 'approved'
            : 'rejected'
      const updated = await transaction.privacyRequest.update({
        where: { id: requestId },
        data: {
          status,
          reviewedAt: now,
          reviewedById: actorUserId,
          reviewReason,
        },
      })
      await recordAuditEvent(transaction, {
        organizationId: access.organizationId,
        schoolId: current.schoolId,
        actorUserId,
        action:
          decision === 'review'
            ? 'privacyRequest.reviewStarted'
            : decision === 'approve'
              ? 'privacyRequest.approved'
              : 'privacyRequest.rejected',
        resourceType: 'privacyRequest',
        resourceId: requestId,
        metadata: { type: current.type },
      })
      return updated
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
  if (decision === 'approve' && request.status === 'approved') {
    if (request.type === 'correction')
      await routePrivacyCorrection(database, actorUserId, requestId)
    if (request.type === 'restriction')
      await applyProcessingRestriction(database, actorUserId, requestId, now)
  }
  return database.privacyRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: {
      officialCorrectionRequest: { select: { id: true, status: true } },
      processingRestrictions: {
        select: { id: true, category: true, status: true },
      },
    },
  })
}

export async function fulfillPrivacyAccessRequest(
  database: PrismaClient,
  actorUserId: string,
  requestId: string,
  now = new Date(),
) {
  z.uuid().parse(actorUserId)
  z.uuid().parse(requestId)
  const request = await database.privacyRequest.findUnique({
    where: { id: requestId },
  })
  if (!request || request.type !== 'access') throw new PrivacyPermissionError()
  await requirePrivacyReviewer(database, actorUserId, request.schoolId, now)
  if (request.requesterUserId === actorUserId)
    throw new PrivacyPermissionError()
  if (request.status === 'fulfilled') return request
  if (request.status !== 'approved') throw new PrivacyReviewStateError()
  await generatePrivacyAccessPackage(database, actorUserId, requestId)
  return database.$transaction(
    async (transaction) => {
      const current = await transaction.privacyRequest.findUniqueOrThrow({
        where: { id: requestId },
      })
      if (current.status !== 'approved' || !current.accessPackage)
        throw new PrivacyReviewStateError()
      const updated = await transaction.privacyRequest.update({
        where: { id: requestId },
        data: { status: 'fulfilled', fulfilledAt: now },
      })
      const school = await transaction.school.findUniqueOrThrow({
        where: { id: request.schoolId },
        select: { organizationId: true },
      })
      await recordAuditEvent(transaction, {
        organizationId: school.organizationId,
        schoolId: request.schoolId,
        actorUserId,
        action: 'privacyRequest.fulfilled',
        resourceType: 'privacyRequest',
        resourceId: requestId,
        metadata: { type: 'access' },
      })
      return updated
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}

export async function cancelOwnPrivacyRequest(
  database: PrismaClient,
  actorUserId: string,
  requestId: string,
) {
  z.uuid().parse(actorUserId)
  z.uuid().parse(requestId)
  const request = await database.privacyRequest.findFirst({
    where: { id: requestId, requesterUserId: actorUserId },
  })
  if (!request) throw new PrivacyPermissionError()
  if (!['submitted', 'underReview'].includes(request.status))
    throw new PrivacyReviewStateError()
  return database.privacyRequest.update({
    where: { id: requestId },
    data: { status: 'cancelled' },
  })
}
