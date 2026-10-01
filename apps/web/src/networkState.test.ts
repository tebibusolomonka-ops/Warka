import { describe, expect, it, vi } from 'vitest'
import { observedNetworkState } from './networkState'

describe('network state', () => {
  it('keeps browser state separate from API reachability', () => {
    vi.stubGlobal('navigator', { onLine: false })
    expect(observedNetworkState()).toEqual({
      browser: 'offline',
      server: 'unknown',
    })
    vi.unstubAllGlobals()
  })
  it('uses connection type only as an optional transient hint', () => {
    vi.stubGlobal('navigator', {
      onLine: true,
      connection: { effectiveType: '2g' },
    })
    expect(observedNetworkState()).toMatchObject({
      browser: 'online',
      server: 'unknown',
      effectiveType: '2g',
    })
    vi.unstubAllGlobals()
  })
})
