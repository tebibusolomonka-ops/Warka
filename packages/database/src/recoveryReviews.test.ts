import { describe, expect, it, vi } from 'vitest'
import {
  createRecoveryReview,
  resolveRecoveryReview,
} from './recoveryReviews.js'

describe('recovery reviews', () => {
  it('stores only controlled safe operational references', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'review' })
    await createRecoveryReview({ recoveryReview: { create } } as never, {
      domain: 'emailDelivery',
      resourceType: 'emailDelivery',
      resourceReference: 'delivery_123',
      reasonCode: 'PROVIDER_OUTCOME_UNKNOWN',
    })
    expect(create).toHaveBeenCalledWith({
      data: {
        domain: 'emailDelivery',
        resourceType: 'emailDelivery',
        resourceReference: 'delivery_123',
        reasonCode: 'PROVIDER_OUTCOME_UNKNOWN',
      },
    })
    await expect(
      createRecoveryReview({ recoveryReview: { create } } as never, {
        domain: 'emailDelivery',
        resourceType: 'emailDelivery',
        resourceReference: 'postgresql://secret@database',
        reasonCode: 'PROVIDER_OUTCOME_UNKNOWN',
      }),
    ).rejects.toThrow()
  })

  it('permits only domain-specific resolutions and audits the actor', async () => {
    const update = vi
      .fn()
      .mockResolvedValue({ id: 'review', status: 'resolved' })
    const auditCreate = vi.fn().mockResolvedValue({})
    const transaction = {
      recoveryReview: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'review',
          status: 'open',
          domain: 'emailDelivery',
        }),
        update,
      },
      auditEvent: { create: auditCreate },
    }
    const database = {
      $transaction: (work: (value: unknown) => Promise<unknown>) =>
        work(transaction),
    }
    await resolveRecoveryReview(database as never, {
      id: 'review',
      actorUserId: '3e480e62-47d7-4525-9d88-b8891e56fac0',
      resolution: 'confirmedDelivered',
    })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resolvedById: expect.any(String) }),
      }),
    )
    expect(auditCreate).toHaveBeenCalledOnce()
  })
})
