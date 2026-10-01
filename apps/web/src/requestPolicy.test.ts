import { describe, expect, it } from 'vitest'
import { criticalMutationAllowed, requestPolicy } from './requestPolicy'

describe('low bandwidth request policy', () => {
  it('reduces optional requests and result sizes', () => {
    expect(requestPolicy('lowBandwidth')).toEqual({
      pageSize: 20,
      automaticSecondaryRefresh: false,
      preloadLargePreviews: false,
      refreshIntervalMs: null,
    })
  })
  it('never disables critical mutations or changes domain values', () => {
    expect(criticalMutationAllowed('lowBandwidth')).toBe(true)
    expect(criticalMutationAllowed('standard')).toBe(true)
  })
})
