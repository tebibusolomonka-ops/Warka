import { describe, expect, it, vi } from 'vitest'
import { FakeEmailProvider } from './emailProvider.js'
import { deriveRecoveryToken } from '@warka/database'
import {
  enqueueTransactionalEmail,
  processQueuedEmailDelivery,
} from './emailOutbox.js'

describe('email outbox', () => {
  it('queues the delivery and task in one transaction', async () => {
    const createDelivery = vi.fn().mockResolvedValue({
      id: 'delivery-id',
      scheduledAt: new Date('2026-09-27T12:00:00Z'),
    })
    const createTask = vi.fn().mockResolvedValue({ id: 'task-id' })
    const database = {
      $transaction: (work: (transaction: unknown) => Promise<unknown>) =>
        work({
          emailDelivery: { create: createDelivery },
          scheduledTaskExecution: { create: createTask },
        }),
    }
    await enqueueTransactionalEmail(database as never, {
      recipientAddress: 'recipient@example.test',
      templateKey: 'passwordChanged',
    })
    expect(createDelivery).toHaveBeenCalledOnce()
    expect(createTask).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskType: 'emailDelivery',
        resourceId: 'delivery-id',
        status: 'pending',
      }),
    })
    await expect(
      enqueueTransactionalEmail(database as never, {
        recipientAddress: 'recipient@example.test',
        templateKey: 'unknownTemplate',
      }),
    ).rejects.toThrow()
  })

  it('claims once, sends, and does not resend a completed delivery', async () => {
    const claim = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
    const update = vi.fn().mockResolvedValue({})
    const database = {
      emailDelivery: {
        updateMany: claim,
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'delivery-id',
          recipientAddress: 'recipient@example.test',
          templateKey: 'passwordChanged',
          recipientUser: { displayName: 'Recipient' },
        }),
        update,
      },
    }
    const provider = new FakeEmailProvider()
    expect(
      await processQueuedEmailDelivery(
        database as never,
        provider,
        'delivery-id',
      ),
    ).toEqual({ status: 'sent' })
    expect(
      await processQueuedEmailDelivery(
        database as never,
        provider,
        'delivery-id',
      ),
    ).toEqual({ status: 'notClaimed' })
    expect(provider.messages).toHaveLength(1)
    expect(update).toHaveBeenCalledWith({
      where: { id: 'delivery-id' },
      data: expect.objectContaining({ status: 'sent' }),
    })
  })

  it('records controlled provider failure without sending again', async () => {
    const update = vi.fn().mockResolvedValue({})
    const database = {
      emailDelivery: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          recipientAddress: 'recipient@example.test',
          templateKey: 'accountSuspended',
          recipientUser: null,
        }),
        update,
      },
    }
    const provider = new FakeEmailProvider([
      { status: 'failed', failureCode: 'REJECTED', retryable: false },
    ])
    expect(
      await processQueuedEmailDelivery(
        database as never,
        provider,
        'delivery-id',
      ),
    ).toEqual({
      status: 'failed',
      failureCode: 'REJECTED',
      retryable: false,
    })
    expect(update).toHaveBeenCalledWith({
      where: { id: 'delivery-id' },
      data: expect.objectContaining({
        status: 'failed',
        failureCode: 'REJECTED',
      }),
    })
  })

  it('renders recovery only at send time without persisting the raw token', async () => {
    const requestId = '45ebd3c0-bd3f-4ec0-8ceb-b1a78de43f01'
    const key = Buffer.alloc(32, 7).toString('base64url')
    const createDelivery = vi.fn().mockResolvedValue({
      id: 'delivery-id',
      scheduledAt: new Date(),
    })
    await enqueueTransactionalEmail(
      {
        $transaction: (work: (transaction: unknown) => Promise<unknown>) =>
          work({
            emailDelivery: { create: createDelivery },
            scheduledTaskExecution: { create: vi.fn() },
          }),
      } as never,
      {
        recipientAddress: 'recipient@example.test',
        recoveryRequestId: requestId,
        templateKey: 'accountRecovery',
      },
    )
    expect(JSON.stringify(createDelivery.mock.calls)).not.toContain(
      deriveRecoveryToken(requestId, key),
    )
    const database = {
      emailDelivery: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          recipientAddress: 'recipient@example.test',
          templateKey: 'accountRecovery',
          recipientUser: { displayName: 'Recipient' },
          recoveryRequest: {
            id: requestId,
            status: 'pending',
            expiresAt: new Date('2030-01-01T00:00:00Z'),
          },
        }),
        update: vi.fn(),
      },
    }
    const provider = new FakeEmailProvider()
    expect(
      await processQueuedEmailDelivery(
        database as never,
        provider,
        'delivery-id',
        new Date('2026-09-27T00:00:00Z'),
        { tokenKey: key, publicAppUrl: 'https://warka.example.test' },
      ),
    ).toEqual({ status: 'sent' })
    expect(provider.messages[0]?.text).toContain(
      deriveRecoveryToken(requestId, key),
    )
  })
})
