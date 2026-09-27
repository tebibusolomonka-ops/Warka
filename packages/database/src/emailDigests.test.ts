import { describe, expect, it, vi } from 'vitest'
import {
  CreateEmailDigestSchema,
  createEmailDigest,
  markEmailDigestSent,
} from './emailDigests.js'

const userId = '123e4567-e89b-42d3-a456-426614174001'
const start = new Date('2026-09-26T00:00:00Z')
const end = new Date('2026-09-27T00:00:00Z')

describe('email digest records', () => {
  it('accepts only nonempty windows and safe metadata', async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 'digest-id' })
    const database = { emailDigest: { upsert } }
    await createEmailDigest(database as never, {
      userId,
      windowStartAt: start,
      windowEndAt: end,
      itemCount: 3,
    })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_windowStartAt_windowEndAt: {
            userId,
            windowStartAt: start,
            windowEndAt: end,
          },
        },
      }),
    )
    expect(() =>
      CreateEmailDigestSchema.parse({
        userId,
        windowStartAt: start,
        windowEndAt: end,
        itemCount: 0,
      }),
    ).toThrow()
    expect(() =>
      CreateEmailDigestSchema.parse({
        userId,
        windowStartAt: end,
        windowEndAt: start,
        itemCount: 1,
      }),
    ).toThrow()
  })

  it('marks only a sending digest as sent', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    await markEmailDigestSent(
      { emailDigest: { updateMany } } as never,
      userId,
      end,
    )
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: userId, status: 'sending' },
      data: { status: 'sent', sentAt: end },
    })
  })
})
