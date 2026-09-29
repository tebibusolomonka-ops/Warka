import { describe, expect, it, vi } from 'vitest'
import { reconcileUnknownEmailDelivery } from './emailOutbox.js'

describe('email delivery reconciliation', () => {
  it('holds ambiguous delivery when the provider cannot verify it', async () => {
    const database = {
      emailDelivery: {
        findUnique: vi.fn().mockResolvedValue({
          status: 'deliveryUnknown',
          providerMessageId: null,
        }),
        updateMany: vi.fn(),
      },
    }
    await expect(
      reconcileUnknownEmailDelivery(
        database as never,
        { send: vi.fn(), health: vi.fn() },
        'delivery',
      ),
    ).resolves.toEqual({ status: 'manualReview' })
    expect(database.emailDelivery.updateMany).not.toHaveBeenCalled()
  })

  it('records a provider-confirmed delivery without resending it', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const database = {
      emailDelivery: {
        findUnique: vi.fn().mockResolvedValue({
          status: 'deliveryUnknown',
          providerMessageId: 'provider-message',
        }),
        updateMany,
      },
    }
    const provider = {
      send: vi.fn(),
      health: vi.fn(),
      lookup: vi.fn().mockResolvedValue('delivered'),
    }
    await expect(
      reconcileUnknownEmailDelivery(
        database as never,
        provider,
        'delivery',
        new Date('2026-09-30T10:00:00.000Z'),
      ),
    ).resolves.toEqual({ status: 'delivered' })
    expect(provider.send).not.toHaveBeenCalled()
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'delivery', status: 'deliveryUnknown' },
        data: expect.objectContaining({ status: 'sent' }),
      }),
    )
  })
})
