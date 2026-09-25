import { describe, expect, it } from 'vitest'
import { emptyRegionalActivity } from './activityReporting.js'

describe('regional activity aggregates', () => {
  it('uses neutral transfer and verification categories', () => {
    const aggregate = emptyRegionalActivity()
    expect(aggregate.transfers).toEqual({
      confirmed: 0,
      unresolved: 0,
      rejected: 0,
    })
    expect(aggregate.verification.unavailable).toBe(0)
    expect(aggregate).not.toHaveProperty('dropout')
    expect(aggregate).not.toHaveProperty('fraud')
  })
})
