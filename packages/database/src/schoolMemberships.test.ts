import { describe, expect, it } from 'vitest'
import { SchoolRoleSchema } from './schoolMemberships.js'

describe('school roles', () => {
  it('accepts the four current staff roles only', () => {
    for (const role of ['administrator', 'registrar', 'teacher', 'approver']) {
      expect(SchoolRoleSchema.parse(role)).toBe(role)
    }
    expect(SchoolRoleSchema.safeParse('student').success).toBe(false)
  })
})
