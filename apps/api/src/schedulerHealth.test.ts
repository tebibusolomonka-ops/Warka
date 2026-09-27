import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import { SchedulerHealthMonitor } from './schedulerHealth.js'

const now = new Date('2026-09-27T12:00:00Z')
const database = (failed = 0) =>
  ({
    scheduledTaskExecution: { count: vi.fn().mockResolvedValue(failed) },
  }) as unknown as PrismaClient

describe('scheduler health', () => {
  it('reports disabled and healthy scheduler states', async () => {
    const monitor = new SchedulerHealthMonitor()
    expect((await monitor.snapshot(database(), now)).status).toBe('disabled')
    monitor.configure(true, 60_000)
    monitor.polled(now)
    expect((await monitor.snapshot(database(), now)).status).toBe('healthy')
  })

  it('reports stale polls and recent failures as degradation', async () => {
    const monitor = new SchedulerHealthMonitor()
    monitor.configure(true, 60_000)
    expect((await monitor.snapshot(database(), now)).status).toBe('degraded')
    monitor.polled(new Date(now.getTime() - 240_000))
    expect((await monitor.snapshot(database(), now)).status).toBe('degraded')
    monitor.polled(now)
    expect((await monitor.snapshot(database(1), now)).status).toBe('degraded')
  })

  it('tracks running and successful work', async () => {
    const monitor = new SchedulerHealthMonitor()
    monitor.configure(true, 60_000)
    monitor.polled(now)
    let release!: () => void
    const wait = new Promise<void>((resolve) => {
      release = resolve
    })
    const task = monitor.track(async () => {
      await wait
    })
    expect((await monitor.snapshot(database(), now)).runningTaskCount).toBe(1)
    release()
    await task
    expect((await monitor.snapshot(database(), now)).runningTaskCount).toBe(0)
    expect(
      (await monitor.snapshot(database(), now)).lastSuccessfulTaskAt,
    ).not.toBeNull()
  })
})
