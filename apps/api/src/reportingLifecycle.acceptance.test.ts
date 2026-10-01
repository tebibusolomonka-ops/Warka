import { describe, expect, it } from 'vitest'

import { validateLifecycle } from './acceptanceContracts.js'

describe('reporting lifecycle acceptance', () => {
  it('preserves submitted versions through bureau review', () => {
    const steps = [
      {
        actor: 'school',
        action: 'readiness check',
        expected: 'quality findings',
      },
      { actor: 'school', action: 'submit v1', expected: 'immutable snapshot' },
      {
        actor: 'bureau',
        action: 'return v1',
        expected: 'school edit required',
      },
      { actor: 'school', action: 'submit v2', expected: 'v1 preserved' },
      { actor: 'bureau', action: 'accept v2', expected: 'accepted version' },
      {
        actor: 'bureau',
        action: 'aggregate export',
        expected: 'no student identities',
      },
    ]
    expect(validateLifecycle(steps)).toEqual([])
    expect(steps[2]?.expected).toBe('school edit required')
  })

  it('preserves blank versus zero and excludes ranking signals', () => {
    const exportRow = {
      reported: 0,
      missing: null,
      studentId: undefined,
      rank: undefined,
    }
    expect(exportRow.reported).toBe(0)
    expect(exportRow.missing).toBeNull()
    expect(exportRow.studentId).toBeUndefined()
    expect(exportRow.rank).toBeUndefined()
  })
})
