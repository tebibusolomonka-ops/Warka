import type { PrismaClient } from '@warka/database'
import { QueueEmailDeliverySchema, deriveRecoveryToken } from '@warka/database'
import type { EmailProvider } from './emailProvider.js'
import { renderTransactionalEmail } from './transactionalEmailTemplates.js'
import { applicationLinkForNotification } from './notificationLinks.js'

const knownTemplates = new Set([
  'accountRecovery',
  'passwordChanged',
  'accountSuspended',
  'accountReactivated',
  'notificationUpdate',
  'notificationDigest',
])

export async function enqueueTransactionalEmail(
  database: PrismaClient,
  input: {
    recipientUserId?: string
    recoveryRequestId?: string
    notificationId?: string
    digestId?: string
    recipientAddress: string
    templateKey: string
    scheduledAt?: Date
  },
) {
  const data = QueueEmailDeliverySchema.parse(input)
  if (!knownTemplates.has(data.templateKey))
    throw new Error('Unknown transactional email template')
  if ((data.templateKey === 'accountRecovery') !== !!data.recoveryRequestId)
    throw new Error(
      'Recovery request reference required only for recovery email',
    )
  if ((data.templateKey === 'notificationUpdate') !== !!data.notificationId)
    throw new Error('Notification reference required only for update email')
  if ((data.templateKey === 'notificationDigest') !== !!data.digestId)
    throw new Error('Digest reference required only for digest email')
  return database.$transaction(async (transaction) => {
    const delivery = await transaction.emailDelivery.create({
      data: {
        recipientUserId: data.recipientUserId ?? null,
        recoveryRequestId: data.recoveryRequestId ?? null,
        notificationId: data.notificationId ?? null,
        digestId: data.digestId ?? null,
        recipientAddress: data.recipientAddress,
        templateKey: data.templateKey,
        ...(data.scheduledAt ? { scheduledAt: data.scheduledAt } : {}),
      },
    })
    await transaction.scheduledTaskExecution.create({
      data: {
        taskType: 'emailDelivery',
        scope: 'transactional_email',
        resourceId: delivery.id,
        scheduledFor: delivery.scheduledAt,
        status: 'pending',
        attempt: 1,
      },
    })
    return delivery
  })
}

export async function processQueuedEmailDelivery(
  database: PrismaClient,
  provider: EmailProvider,
  id: string,
  now = new Date(),
  recovery?: { tokenKey: string; publicAppUrl: string },
) {
  const claimed = await database.emailDelivery.updateMany({
    where: { id, status: 'queued', scheduledAt: { lte: now } },
    data: {
      status: 'sending',
      startedAt: now,
      attemptCount: { increment: 1 },
    },
  })
  if (claimed.count !== 1) return { status: 'notClaimed' as const }
  const delivery = await database.emailDelivery.findUniqueOrThrow({
    where: { id },
    include: {
      recipientUser: { select: { displayName: true } },
      recoveryRequest: {
        select: { id: true, status: true, expiresAt: true },
      },
      notification: { select: { type: true } },
      digest: { select: { id: true, status: true, itemCount: true } },
    },
  })
  const templateKey = delivery.templateKey
  let result: Awaited<ReturnType<EmailProvider['send']>>
  try {
    const common = {
      to: delivery.recipientAddress,
      displayName: delivery.recipientUser?.displayName ?? 'Warka user',
    }
    let message
    if (templateKey === 'accountRecovery') {
      if (
        !recovery ||
        !delivery.recoveryRequest ||
        delivery.recoveryRequest.status !== 'pending' ||
        delivery.recoveryRequest.expiresAt <= now
      )
        throw new Error('Recovery request is unavailable')
      const url = new URL(recovery.publicAppUrl)
      url.pathname = '/'
      url.search = ''
      url.hash = ''
      url.searchParams.set(
        'recoveryToken',
        deriveRecoveryToken(delivery.recoveryRequest.id, recovery.tokenKey),
      )
      message = renderTransactionalEmail({
        templateKey,
        ...common,
        recoveryUrl: url.toString(),
      })
    } else if (
      templateKey === 'passwordChanged' ||
      templateKey === 'accountSuspended' ||
      templateKey === 'accountReactivated'
    ) {
      message = renderTransactionalEmail({ templateKey, ...common })
    } else if (templateKey === 'notificationUpdate') {
      if (!recovery || !delivery.notification)
        throw new Error('Notification link is unavailable')
      message = renderTransactionalEmail({
        templateKey,
        ...common,
        applicationUrl: applicationLinkForNotification(
          recovery.publicAppUrl,
          delivery.notification.type,
        ),
      })
    } else if (templateKey === 'notificationDigest') {
      if (!recovery || !delivery.digest || delivery.digest.status !== 'queued')
        throw new Error('Digest is unavailable')
      const digestClaim = await database.emailDigest.updateMany({
        where: { id: delivery.digest.id, status: 'queued' },
        data: { status: 'sending' },
      })
      if (digestClaim.count !== 1) throw new Error('Digest is unavailable')
      message = renderTransactionalEmail({
        templateKey,
        ...common,
        itemCount: delivery.digest.itemCount,
        applicationUrl: applicationLinkForNotification(
          recovery.publicAppUrl,
          'notification.digest',
        ),
      })
    } else throw new Error('Unknown transactional email template')
    result = await provider.send(message)
  } catch {
    result = { status: 'failed', failureCode: 'AMBIGUOUS', retryable: false }
  }
  if (result.status === 'sent') {
    await database.emailDelivery.update({
      where: { id },
      data: {
        status: 'sent',
        sentAt: now,
        failureCode: null,
        providerMessageId: result.providerMessageId ?? null,
      },
    })
    if (delivery.digest)
      await database.emailDigest.updateMany({
        where: { id: delivery.digest.id, status: 'sending' },
        data: { status: 'sent', sentAt: now },
      })
  } else {
    await database.emailDelivery.update({
      where: { id },
      data: {
        status: 'failed',
        failedAt: now,
        failureCode: result.failureCode,
      },
    })
    if (delivery.digest)
      await database.emailDigest.updateMany({
        where: { id: delivery.digest.id, status: 'sending' },
        data: { status: 'failed' },
      })
  }
  return result
}
