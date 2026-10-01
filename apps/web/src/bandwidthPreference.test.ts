import { expect, it } from 'vitest'
import { suggestedLowBandwidth } from './bandwidthPreference'

it('suggests but does not persist from a network hint', () => {
  expect(suggestedLowBandwidth('2g')).toBe(true)
  expect(localStorage.getItem('bandwidthPreference')).toBeNull()
})
