import type { PrismaClient } from '@warka/database'
import { QueueEmailDeliverySchema } from '@warka/database'
import type { EmailProvider } from './emailProvider.js'
import { renderTransactionalEmail } from './transactionalEmailTemplates.js'

const knownTemplates = new Set([
  'passwordChanged',
  'accountSuspended',
  'accountReactivated',
])

export async function enqueueTransactionalEmail(
  database: PrismaClient,
  input: {
    recipientUserId?: string
    recipientAddress: string
    templateKey: string
    scheduledAt?: Date
  },
) {
  const data = QueueEmailDeliverySchema.parse(input)
  if (!knownTemplates.has(data.templateKey))
    throw new Error('Unknown transactional email template')
  return database.$transaction(async (transaction) => {
    const delivery = await transaction.emailDelivery.create({
      data: {
        recipientUserId: data.recipientUserId ?? null,
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
    include: { recipientUser: { select: { displayName: true } } },
  })
  const templateKey = delivery.templateKey
  if (
    templateKey !== 'passwordChanged' &&
    templateKey !== 'accountSuspended' &&
    templateKey !== 'accountReactivated'
  )
    throw new Error('Unknown transactional email template')
  let result: Awaited<ReturnType<EmailProvider['send']>>
  try {
    const message = renderTransactionalEmail({
      templateKey,
      to: delivery.recipientAddress,
      displayName: delivery.recipientUser?.displayName ?? 'Warka user',
    })
    result = await provider.send(message)
  } catch {
    result = { status: 'failed', failureCode: 'UNAVAILABLE', retryable: false }
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
  } else {
    await database.emailDelivery.update({
      where: { id },
      data: {
        status: 'failed',
        failedAt: now,
        failureCode: result.failureCode,
      },
    })
  }
  return result
}
