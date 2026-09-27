import { describe, expect, it } from 'vitest'
import { retryEligible } from './schedulerRetry.js'

const now = new Date('2026-09-27T12:00:00Z')
const failed = (
  attempt: number,
  minutesAgo: number,
  failureCode = 'BACKUP_FAILED',
) => ({
  status: 'failed',
  attempt,
  failureCode,
  completedAt: new Date(now.getTime() - minutesAgo * 60_000),
})

describe('scheduled retry limits', () => {
  it('retries after bounded backoff', () => {
    expect(retryEligible(failed(1, 1), now)).toBe(true)
    expect(retryEligible(failed(2, 2), now)).toBe(true)
    expect(retryEligible(failed(2, 1), now)).toBe(false)
  })

  it('stops at max attempts and rejects non-retryable failures', () => {
    expect(retryEligible(failed(3, 10), now)).toBe(false)
    expect(retryEligible(failed(1, 10, 'CONFIGURATION_ERROR'), now)).toBe(false)
    expect(retryEligible({ ...failed(1, 10), status: 'completed' }, now)).toBe(
      false,
    )
  })
})
