import { describe, expect, it, vi } from 'vitest'
import {
  claimScheduledTask,
  completeScheduledTask,
  createWorkerInstanceId,
} from './scheduledTaskExecutions.js'

describe('scheduled task leases', () => {
  it('claims pending work for one generated process instance', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const workerId = createWorkerInstanceId()
    const now = new Date('2026-09-30T10:00:00.000Z')
    await expect(
      claimScheduledTask(
        { scheduledTaskExecution: { updateMany } } as never,
        'execution',
        workerId,
        { now, leaseMs: 60_000 },
      ),
    ).resolves.toBe(true)
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'execution', status: 'pending' },
      data: expect.objectContaining({
        workerId,
        claimedAt: now,
        heartbeatAt: now,
        leaseExpiresAt: new Date('2026-09-30T10:01:00.000Z'),
      }),
    })
  })

  it('allows only one concurrent claim', async () => {
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
    const database = { scheduledTaskExecution: { updateMany } } as never
    await expect(
      claimScheduledTask(database, 'execution', createWorkerInstanceId()),
    ).resolves.toBe(true)
    await expect(
      claimScheduledTask(database, 'execution', createWorkerInstanceId()),
    ).resolves.toBe(false)
  })

  it('requires the current unexpired owner to complete leased work', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 })
    const now = new Date('2026-09-30T10:00:00.000Z')
    await expect(
      completeScheduledTask(
        { scheduledTaskExecution: { updateMany } } as never,
        'execution',
        undefined,
        undefined,
        { workerId: createWorkerInstanceId(), now },
      ),
    ).rejects.toThrow('Scheduled task is not running')
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ leaseExpiresAt: { gt: now } }),
      }),
    )
  })
})
