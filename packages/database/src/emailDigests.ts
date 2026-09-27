import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const CreateEmailDigestSchema = z
  .strictObject({
    userId: z.uuid(),
    windowStartAt: z.date(),
    windowEndAt: z.date(),
    itemCount: z.number().int().positive().max(10_000),
  })
  .refine((data) => data.windowEndAt > data.windowStartAt)

export function createEmailDigest(
  database: Pick<PrismaClient, 'emailDigest'>,
  input: z.input<typeof CreateEmailDigestSchema>,
) {
  const data = CreateEmailDigestSchema.parse(input)
  return database.emailDigest.upsert({
    where: {
      userId_windowStartAt_windowEndAt: {
        userId: data.userId,
        windowStartAt: data.windowStartAt,
        windowEndAt: data.windowEndAt,
      },
    },
    create: data,
    update: {},
  })
}

export function listEmailDigests(
  database: Pick<PrismaClient, 'emailDigest'>,
  userId: string,
  take = 20,
) {
  return database.emailDigest.findMany({
    where: { userId: z.uuid().parse(userId) },
    orderBy: [{ windowEndAt: 'desc' }, { id: 'desc' }],
    take: z.number().int().min(1).max(50).parse(take),
  })
}

export function markEmailDigestSent(
  database: Pick<PrismaClient, 'emailDigest'>,
  id: string,
  sentAt = new Date(),
) {
  return database.emailDigest.updateMany({
    where: { id: z.uuid().parse(id), status: 'sending' },
    data: { status: 'sent', sentAt },
  })
}
