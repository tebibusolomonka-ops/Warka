import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { recordAuditEvent } from './auditEvents.js'

const RecoveryDomainSchema = z.enum([
  'scheduledTask',
  'emailDelivery',
  'fileScan',
  'backup',
  'restoreRehearsal',
])
const safeReference = z.string().regex(/^[a-zA-Z0-9_-]{1,120}$/)
const reasonCode = z.string().regex(/^[A-Z_]{1,60}$/)
const resolutionByDomain = {
  scheduledTask: ['retryApproved', 'dismissed'],
  emailDelivery: ['confirmedDelivered', 'confirmedNotDelivered', 'dismissed'],
  fileScan: ['rescanApproved', 'quarantined', 'dismissed'],
  backup: ['verificationRequired', 'dismissed'],
  restoreRehearsal: ['targetReviewed', 'dismissed'],
} as const

export async function createRecoveryReview(
  database: Pick<PrismaClient, 'recoveryReview'>,
  input: {
    domain: z.input<typeof RecoveryDomainSchema>
    resourceType: string
    resourceReference: string
    reasonCode: string
  },
) {
  const domain = RecoveryDomainSchema.parse(input.domain)
  return database.recoveryReview.create({
    data: {
      domain,
      resourceType: safeReference.parse(input.resourceType),
      resourceReference: safeReference.parse(input.resourceReference),
      reasonCode: reasonCode.parse(input.reasonCode),
    },
  })
}

export async function resolveRecoveryReview(
  database: PrismaClient,
  input: {
    id: string
    actorUserId: string
    resolution: string
    dismiss?: boolean
  },
) {
  return database.$transaction(async (transaction) => {
    const review = await transaction.recoveryReview.findUniqueOrThrow({
      where: { id: input.id },
    })
    if (review.status !== 'open') throw new Error('Recovery review is not open')
    const allowed = resolutionByDomain[review.domain]
    if (!(allowed as readonly string[]).includes(input.resolution))
      throw new Error('Unsupported recovery resolution')
    const updated = await transaction.recoveryReview.update({
      where: { id: review.id },
      data: {
        status: input.dismiss ? 'dismissed' : 'resolved',
        resolvedAt: new Date(),
        resolvedById: input.actorUserId,
        resolution: input.resolution,
      },
    })
    await recordAuditEvent(transaction, {
      actorUserId: input.actorUserId,
      action: 'recoveryReview.resolved',
      resourceType: 'recoveryReview',
      resourceId: review.id,
      metadata: {
        domain: review.domain,
        resolution: input.resolution,
      },
    })
    return updated
  })
}
