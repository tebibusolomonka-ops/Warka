import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const QueueEmailDeliverySchema = z.strictObject({
  recipientUserId: z.uuid().optional(),
  recipientAddress: z.email().max(320),
  templateKey: z.string().regex(/^[a-z][a-zA-Z0-9.]{1,63}$/),
  scheduledAt: z.date().optional(),
})

export type QueueEmailDelivery = z.input<typeof QueueEmailDeliverySchema>

export function queueEmailDelivery(
  database: Pick<PrismaClient, 'emailDelivery'>,
  input: QueueEmailDelivery,
) {
  const data = QueueEmailDeliverySchema.parse(input)
  return database.emailDelivery.create({
    data: {
      recipientUserId: data.recipientUserId ?? null,
      recipientAddress: data.recipientAddress,
      templateKey: data.templateKey,
      ...(data.scheduledAt ? { scheduledAt: data.scheduledAt } : {}),
    },
  })
}

export function getEmailDelivery(
  database: Pick<PrismaClient, 'emailDelivery'>,
  id: string,
) {
  return database.emailDelivery.findUnique({
    where: { id: z.uuid().parse(id) },
  })
}

export function listEmailDeliveries(
  database: Pick<PrismaClient, 'emailDelivery'>,
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled',
  take = 50,
) {
  return database.emailDelivery.findMany({
    where: { status },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: z.number().int().min(1).max(100).parse(take),
  })
}

export function cancelQueuedEmailDelivery(
  database: Pick<PrismaClient, 'emailDelivery'>,
  id: string,
) {
  return database.emailDelivery.updateMany({
    where: { id: z.uuid().parse(id), status: 'queued' },
    data: { status: 'cancelled' },
  })
}
