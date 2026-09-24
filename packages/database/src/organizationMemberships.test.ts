import { describe, expect, it } from 'vitest'
import { OrganizationRoleSchema } from './organizationMemberships.js'

describe('organization roles', () => {
  it('accepts only the current administrative roles', () => {
    expect(OrganizationRoleSchema.parse('owner')).toBe('owner')
    expect(OrganizationRoleSchema.parse('administrator')).toBe('administrator')
    expect(OrganizationRoleSchema.safeParse('teacher').success).toBe(false)
  })
})
