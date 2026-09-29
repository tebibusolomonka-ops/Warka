import { describe, expect, it, vi } from 'vitest'
import { createApplicationShutdown } from './applicationShutdown.js'

describe('application shutdown', () => {
  it('stops new worker claims before closing the HTTP server once', async () => {
    const order: string[] = []
    const stop = vi.fn(async () => {
      order.push('stop')
    })
    const closeServer = vi.fn(async () => {
      order.push('close')
    })
    const shutdown = createApplicationShutdown({
      stopWorkers: [{ stop }],
      closeServer,
      onTimeout: vi.fn(),
    })
    await Promise.all([shutdown(), shutdown()])
    expect(order).toEqual(['stop', 'close'])
    expect(stop).toHaveBeenCalledOnce()
    expect(closeServer).toHaveBeenCalledOnce()
  })

  it('enforces a bounded drain period', async () => {
    vi.useFakeTimers()
    try {
      const onTimeout = vi.fn()
      const shutdown = createApplicationShutdown({
        stopWorkers: [{ stop: () => new Promise(() => undefined) }],
        closeServer: vi.fn(),
        onTimeout,
        drainMs: 1000,
      })
      void shutdown()
      await vi.advanceTimersByTimeAsync(1000)
      expect(onTimeout).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })
})
