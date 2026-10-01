import { describe, expect, it, vi } from 'vitest'
import {
  AmbiguousMutationError,
  retrySafeRead,
  runMutationOnce,
} from './requestRecovery'

describe('request recovery', () => {
  it('retries a safe read after reconnect', async () => {
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error())
      .mockResolvedValue({ current: true })
    await expect(retrySafeRead(read)).resolves.toEqual({ current: true })
    expect(read).toHaveBeenCalledTimes(2)
  })
  it('never blindly replays an ambiguous mutation', async () => {
    const mutate = vi.fn().mockRejectedValue(new Error('network'))
    await expect(runMutationOnce(mutate)).rejects.toBeInstanceOf(
      AmbiguousMutationError,
    )
    expect(mutate).toHaveBeenCalledTimes(1)
  })
})
