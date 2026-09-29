import { describe, expect, it, vi } from 'vitest'
import { FakeEmailProvider } from './emailProvider.js'
import {
  EmailOutboxScheduler,
  emailRetryEligible,
} from './emailOutboxScheduler.js'

const now = new Date('2026-09-27T12:10:00Z')

describe('email delivery retries', () => {
  it('allows bounded backoff only for known retryable failures', () => {
    const task = {
      status: 'failed',
      attempt: 1,
      failureCode: 'UNAVAILABLE',
      completedAt: new Date(now.getTime() - 60_001),
    }
    expect(emailRetryEligible(task, now)).toBe(true)
    expect(emailRetryEligible({ ...task, failureCode: 'TIMEOUT' }, now)).toBe(
      false,
    )
    expect(emailRetryEligible({ ...task, attempt: 3 }, now)).toBe(false)
    expect(
      emailRetryEligible(
        { ...task, completedAt: new Date(now.getTime() - 20_000) },
        now,
      ),
    ).toBe(false)
  })

  it('atomically schedules one retry for a failed delivery', async () => {
    const failure = {
      id: 'task-id',
      seriesId: 'series-id',
      resourceId: 'delivery-id',
      status: 'failed',
      attempt: 1,
      failureCode: 'UNAVAILABLE',
      completedAt: new Date(now.getTime() - 60_001),
    }
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([failure])
      .mockResolvedValueOnce([])
    const create = vi.fn()
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const transaction = {
      scheduledTaskExecution: {
        findFirst: vi.fn().mockResolvedValue(null),
        create,
      },
      emailDelivery: {
        updateMany,
        findUnique: vi.fn().mockResolvedValue({ digestId: null }),
      },
    }
    const database = {
      reportingPeriod: { findMany: vi.fn().mockResolvedValue([]) },
      notification: { findMany: vi.fn().mockResolvedValue([]) },
      notificationPreference: { findMany: vi.fn().mockResolvedValue([]) },
      scheduledTaskExecution: { findMany },
      $transaction: (work: (value: unknown) => Promise<unknown>) =>
        work(transaction),
    }
    const scheduler = new EmailOutboxScheduler(
      database as never,
      {
        enabled: true,
        intervalMs: 15000,
        databaseUrl: '',
        recovery: { tokenKey: '', publicAppUrl: '' },
      },
      new FakeEmailProvider(),
      { run: async (work: () => Promise<void>) => work() },
    )
    await scheduler.tick(now)
    expect(updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'delivery-id',
        status: 'failed',
        attemptCount: 1,
      }),
      data: expect.objectContaining({ status: 'queued' }),
    })
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        seriesId: 'series-id',
        attempt: 2,
        resourceId: 'delivery-id',
      }),
    })
  })
})
