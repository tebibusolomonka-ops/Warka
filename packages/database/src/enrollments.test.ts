import { describe, expect, it } from 'vitest'
import { CreateEnrollmentSchema, canTransition } from './enrollments.js'

const id = '123e4567-e89b-42d3-a456-426614174000'

describe('enrollment rules', () => {
  it('accepts only structure fields when creating a draft', () => {
    expect(
      CreateEnrollmentSchema.parse({
        studentId: id,
        schoolId: id,
        academicYearId: id,
        gradeLevelId: id,
      }),
    ).toMatchObject({ studentId: id, schoolId: id })
    expect(() =>
      CreateEnrollmentSchema.parse({
        studentId: id,
        schoolId: id,
        academicYearId: id,
        gradeLevelId: id,
        status: 'approved',
      }),
    ).toThrow()
  })

  it('allows only explicit lifecycle transitions', () => {
    expect(canTransition('draft', 'submit')).toBe(true)
    expect(canTransition('pending', 'approve')).toBe(true)
    expect(canTransition('draft', 'withdraw')).toBe(true)
    expect(canTransition('pending', 'withdraw')).toBe(true)
    expect(canTransition('approved', 'withdraw')).toBe(true)
    for (const status of ['pending', 'approved', 'withdrawn'] as const) {
      expect(canTransition(status, 'submit')).toBe(false)
    }
    for (const status of ['draft', 'approved', 'withdrawn'] as const) {
      expect(canTransition(status, 'approve')).toBe(false)
    }
    expect(canTransition('withdrawn', 'withdraw')).toBe(false)
  })
})
