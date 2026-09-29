import { describe, expect, it, vi } from 'vitest'
import { heartbeatScheduledTask } from '@warka/database'
import { withTaskHeartbeat } from './taskHeartbeat.js'

vi.mock('@warka/database', async (load) => ({
  ...(await load<typeof import('@warka/database')>()),
  heartbeatScheduledTask: vi.fn(),
}))

describe('task heartbeat loop', () => {
  it('stops after completion', async () => {
    vi.useFakeTimers()
    vi.mocked(heartbeatScheduledTask).mockResolvedValue(true)
    await withTaskHeartbeat({
      database: {} as never,
      executionId: 'execution',
      workerId: 'worker_00000000-0000-4000-8000-000000000001',
      leaseMs: 5_000,
      intervalMs: 1_000,
      work: async () => 'done',
    })
    await vi.advanceTimersByTimeAsync(2_000)
    expect(heartbeatScheduledTask).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('refuses a successful result after heartbeat ownership loss', async () => {
    vi.useFakeTimers()
    vi.mocked(heartbeatScheduledTask).mockResolvedValue(false)
    let finish!: () => void
    const work = new Promise<void>((resolve) => {
      finish = resolve
    })
    const result = withTaskHeartbeat({
      database: {} as never,
      executionId: 'execution',
      workerId: 'worker_00000000-0000-4000-8000-000000000001',
      leaseMs: 5_000,
      intervalMs: 1_000,
      work: () => work,
    })
    await vi.advanceTimersByTimeAsync(1_000)
    finish()
    await expect(result).rejects.toThrow('Scheduled task lease lost')
    vi.useRealTimers()
  })

  it('stops database heartbeats during shutdown while work drains', async () => {
    vi.useFakeTimers()
    vi.mocked(heartbeatScheduledTask).mockClear()
    let active = true
    let finish!: () => void
    const work = new Promise<void>((resolve) => {
      finish = resolve
    })
    const result = withTaskHeartbeat({
      database: {} as never,
      executionId: 'execution',
      workerId: 'worker_00000000-0000-4000-8000-000000000001',
      leaseMs: 5_000,
      intervalMs: 1_000,
      active: () => active,
      work: () => work,
    })
    active = false
    await vi.advanceTimersByTimeAsync(2_000)
    expect(heartbeatScheduledTask).not.toHaveBeenCalled()
    finish()
    await expect(result).resolves.toBeUndefined()
    vi.useRealTimers()
  })
})
