import { describe, expect, it } from 'vitest'

import { validateLifecycle } from './acceptanceContracts.js'

describe('academic lifecycle acceptance', () => {
  it('moves an enrolled student through controlled publication', () => {
    const steps = [
      { actor: 'registrar', action: 'enroll', expected: 'active enrollment' },
      { actor: 'teacher', action: 'attendance', expected: 'recorded' },
      { actor: 'teacher', action: 'mark', expected: 'draft gradebook' },
      { actor: 'teacher', action: 'lock', expected: 'complete gradebook' },
      {
        actor: 'administrator',
        action: 'approve',
        expected: 'approved result',
      },
      {
        actor: 'administrator',
        action: 'publish',
        expected: 'immutable snapshot',
      },
      { actor: 'student', action: 'view', expected: 'published result' },
    ]
    expect(validateLifecycle(steps)).toEqual([])
  })

  it('keeps zero, absent, and missing distinct', () => {
    const marks = [
      { kind: 'score', value: 0 },
      { kind: 'absent' },
      { kind: 'missing' },
    ]
    expect(new Set(marks.map((mark) => mark.kind)).size).toBe(3)
    expect(marks[0]).toEqual({ kind: 'score', value: 0 })
  })
})
