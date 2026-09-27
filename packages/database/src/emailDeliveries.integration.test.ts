import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { createDatabaseClient } from './index.js'
import {
  QueueEmailDeliverySchema,
  cancelQueuedEmailDelivery,
  getEmailDelivery,
  listEmailDeliveries,
  queueEmailDelivery,
} from './emailDeliveries.js'

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
const database = url ? createDatabaseClient({ DATABASE_URL: url }) : null

afterAll(async () => {
  await database?.$disconnect()
})

describe.skipIf(!database)('email deliveries in PostgreSQL', () => {
  it('queues safe metadata and permits cancellation only while queued', async () => {
    const user = await database!.user.create({
      data: {
        email: `email-delivery-${randomUUID()}@example.test`,
        displayName: 'Email Recipient',
      },
    })
    try {
      const delivery = await queueEmailDelivery(database!, {
        recipientUserId: user.id,
        recipientAddress: user.email,
        templateKey: 'passwordChanged',
      })
      expect(delivery.status).toBe('queued')
      expect(delivery.attemptCount).toBe(0)
      expect(delivery.providerMessageId).toBeNull()
      expect((await getEmailDelivery(database!, delivery.id))?.id).toBe(
        delivery.id,
      )
      expect(
        (await listEmailDeliveries(database!, 'queued')).some(
          (item) => item.id === delivery.id,
        ),
      ).toBe(true)
      expect(
        (await cancelQueuedEmailDelivery(database!, delivery.id)).count,
      ).toBe(1)
      expect(
        (await cancelQueuedEmailDelivery(database!, delivery.id)).count,
      ).toBe(0)
      expect((await getEmailDelivery(database!, delivery.id))?.status).toBe(
        'cancelled',
      )
    } finally {
      await database!.user.delete({ where: { id: user.id } })
    }
  })
})

describe('email delivery metadata', () => {
  it('rejects body or token fields', () => {
    expect(() =>
      QueueEmailDeliverySchema.parse({
        recipientAddress: 'recipient@example.test',
        templateKey: 'accountRecovery',
        recoveryToken: 'private-token',
      }),
    ).toThrow()
  })
})
