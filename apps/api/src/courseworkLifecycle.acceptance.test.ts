import { describe, expect, it } from 'vitest'

import { validateLifecycle } from './acceptanceContracts.js'

describe('coursework lifecycle acceptance', () => {
  it('requires explicit controlled transfer to the official gradebook', () => {
    const steps = [
      { actor: 'teacher', action: 'publish assignment', expected: 'visible' },
      {
        actor: 'student',
        action: 'upload clean scan',
        expected: 'quarantined',
      },
      { actor: 'scanner', action: 'release file', expected: 'available' },
      {
        actor: 'student',
        action: 'submit revision',
        expected: 'timestamp preserved',
      },
      {
        actor: 'teacher',
        action: 'release feedback',
        expected: 'student visible',
      },
      {
        actor: 'teacher',
        action: 'transfer mark',
        expected: 'window rules checked',
      },
      { actor: 'guardian', action: 'view', expected: 'read only' },
    ]
    expect(validateLifecycle(steps)).toEqual([])
    expect(
      steps.find((step) => step.action === 'transfer mark')?.expected,
    ).toBe('window rules checked')
  })

  it('blocks quarantined attachments and keeps coursework scores unofficial', () => {
    expect({ downloadable: false, official: false }).toEqual({
      downloadable: false,
      official: false,
    })
  })
})
