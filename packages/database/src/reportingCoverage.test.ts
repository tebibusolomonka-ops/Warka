import { describe, expect, it } from 'vitest'
import { calculateCoverage, calculateFreshness } from './reportingCoverage.js'

describe('reporting coverage and freshness', () => {
  it('keeps missing, zero, returned, and approved states distinct', () => {
    expect(calculateCoverage(3, ['draft', 'returned'])).toEqual({
      expected: 3,
      draft: 1,
      submitted: 0,
      approved: 0,
      returned: 1,
      missing: 1,
    })
    expect(calculateCoverage(0, []).missing).toBe(0)
    expect(calculateFreshness(undefined, new Date('2026-01-01'))).toBe(
      'missing',
    )
    expect(calculateFreshness('approved', new Date('2026-01-01'))).toBe(
      'current',
    )
  })
})
