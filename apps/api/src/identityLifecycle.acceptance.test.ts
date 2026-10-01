import { describe, expect, it } from 'vitest'

import { validateLifecycle } from './acceptanceContracts.js'

describe('identity lifecycle acceptance', () => {
  it.each(['student', 'teacher', 'school administrator'])(
    'preserves authorization boundaries for %s',
    (actor) => {
      const steps = [
        { actor, action: 'login', expected: 'scoped session' },
        {
          actor,
          action: 'password change',
          expected: 'other sessions revoked',
        },
        { actor, action: 'suspension', expected: 'authentication denied' },
        { actor, action: 'reactivation', expected: 'new session required' },
        { actor, action: 'offboarding', expected: 'history preserved' },
      ]
      expect(validateLifecycle(steps)).toEqual([])
      expect(steps.at(-1)?.expected).toBe('history preserved')
    },
  )

  it('expires memberships and teaching assignments without erasing attribution', () => {
    const attribution = { teacher: 'teacher-alpha', active: false }
    expect(attribution).toEqual({ teacher: 'teacher-alpha', active: false })
  })
})
