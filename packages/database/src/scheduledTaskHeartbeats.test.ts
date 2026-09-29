import { describe, expect, it, vi } from 'vitest'
import { heartbeatScheduledTask } from './scheduledTaskExecutions.js'

describe('scheduled task heartbeats', () => {
  it('extends an owned unexpired lease using a controlled clock', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 })
    const now = new Date('2026-09-30T10:00:00.000Z')
    await expect(
      heartbeatScheduledTask(
        { scheduledTaskExecution: { updateMany } } as never,
        'execution',
        'worker_00000000-0000-4000-8000-000000000001',
        { now, leaseMs: 60_000 },
      ),
    ).resolves.toBe(true)
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'execution',
        status: 'running',
        workerId: 'worker_00000000-0000-4000-8000-000000000001',
        leaseExpiresAt: { gt: now },
      },
      data: {
        heartbeatAt: now,
        leaseExpiresAt: new Date('2026-09-30T10:01:00.000Z'),
      },
    })
  })

  it('reports ownership loss without creating another lease', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 })
    await expect(
      heartbeatScheduledTask(
        { scheduledTaskExecution: { updateMany } } as never,
        'execution',
        'worker_00000000-0000-4000-8000-000000000002',
      ),
    ).resolves.toBe(false)
  })
})
