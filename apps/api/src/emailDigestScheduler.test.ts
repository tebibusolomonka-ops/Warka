import { describe, expect, it, vi } from 'vitest'
import {
  digestWindow,
  scheduleDueEmailDigests,
} from './emailDigestScheduler.js'

const now = new Date('2026-09-27T12:00:00Z')
const userId = '123e4567-e89b-42d3-a456-426614174001'

describe('scheduled email digests', () => {
  it('uses completed UTC daily and weekly windows', () => {
    expect(digestWindow('daily', now)).toEqual({
      start: new Date('2026-09-26T00:00:00Z'),
      end: new Date('2026-09-27T00:00:00Z'),
    })
    expect(digestWindow('weekly', now)).toEqual({
      start: new Date('2026-09-14T00:00:00Z'),
      end: new Date('2026-09-21T00:00:00Z'),
    })
  })

  it('queues one digest for a recipient and window across duplicate ticks', async () => {
    const createDelivery = vi.fn().mockResolvedValue({ id: 'delivery-id' })
    const createTask = vi.fn().mockResolvedValue({})
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'digest-id',
        status: 'queued',
        delivery: null,
      })
      .mockResolvedValueOnce({
        id: 'digest-id',
        status: 'queued',
        delivery: { id: 'delivery-id' },
      })
    const count = vi.fn().mockResolvedValue(2)
    const transaction = {
      emailDigest: { upsert },
      emailDelivery: { create: createDelivery },
      scheduledTaskExecution: { create: createTask },
    }
    const database = {
      notificationPreference: {
        findMany: vi.fn().mockResolvedValue([
          {
            userId,
            category: 'schoolAnnouncements',
            digestCadence: 'daily',
            updatedAt: new Date('2026-09-25T00:00:00Z'),
            user: { email: 'recipient@example.test' },
          },
        ]),
      },
      notification: { count },
      $transaction: (work: (value: unknown) => Promise<unknown>) =>
        work(transaction),
    }
    expect(await scheduleDueEmailDigests(database as never, now)).toEqual({
      queued: 1,
    })
    expect(await scheduleDueEmailDigests(database as never, now)).toEqual({
      queued: 0,
    })
    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({ userId }),
    })
    expect(createDelivery).toHaveBeenCalledOnce()
    expect(createTask).toHaveBeenCalledOnce()
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_windowStartAt_windowEndAt: {
            userId,
            windowStartAt: new Date('2026-09-26T00:00:00Z'),
            windowEndAt: new Date('2026-09-27T00:00:00Z'),
          },
        },
      }),
    )
  })

  it('does not queue an empty digest', async () => {
    const upsert = vi.fn()
    const database = {
      notificationPreference: {
        findMany: vi.fn().mockResolvedValue([
          {
            userId,
            category: 'academicResults',
            digestCadence: 'daily',
            updatedAt: new Date('2026-09-25T00:00:00Z'),
            user: { email: 'recipient@example.test' },
          },
        ]),
      },
      notification: { count: vi.fn().mockResolvedValue(0) },
      $transaction: upsert,
    }
    expect(await scheduleDueEmailDigests(database as never, now)).toEqual({
      queued: 0,
    })
    expect(upsert).not.toHaveBeenCalled()
  })
})
