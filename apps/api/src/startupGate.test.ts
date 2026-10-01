import { describe, expect, it, vi } from 'vitest'
import { StartupGate } from './startupGate.js'

describe('StartupGate', () => {
  it('is pending until required checks pass', async () => {
    const gate = new StartupGate()
    expect(gate.snapshot().state).toBe('pending')
    await expect(gate.run(async () => true)).resolves.toMatchObject({
      state: 'ready',
    })
  })

  it('blocks failed and timed out checks', async () => {
    const failed = new StartupGate()
    await failed.run(async () => false)
    expect(failed.snapshot().state).toBe('blocked')
    vi.useFakeTimers()
    const timed = new StartupGate()
    const result = timed.run(() => new Promise(() => {}), 10)
    await vi.advanceTimersByTimeAsync(10)
    await expect(result).resolves.toMatchObject({ state: 'blocked' })
    vi.useRealTimers()
  })
})
