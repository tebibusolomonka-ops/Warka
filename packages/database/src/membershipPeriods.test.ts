import { describe, expect, it } from 'vitest'
import { isMembershipEffective } from './membershipPeriods.js'

describe('membership effective periods', () => {
  const now = new Date('2026-09-27T12:00:00Z')
  it('accepts current membership and rejects future or expired periods', () => {
    expect(
      isMembershipEffective(
        { startsAt: new Date('2026-09-26'), endsAt: null },
        now,
      ),
    ).toBe(true)
    expect(
      isMembershipEffective(
        { startsAt: now, endsAt: new Date('2026-09-28') },
        now,
      ),
    ).toBe(true)
    expect(
      isMembershipEffective(
        { startsAt: new Date('2026-09-28'), endsAt: null },
        now,
      ),
    ).toBe(false)
    expect(
      isMembershipEffective(
        { startsAt: new Date('2026-09-26'), endsAt: now },
        now,
      ),
    ).toBe(false)
    expect(isMembershipEffective(null, now)).toBe(false)
  })
})
