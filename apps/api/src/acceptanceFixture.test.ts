import { describe, expect, it } from 'vitest'

import { acceptanceFixture } from './acceptanceFixture.js'

describe('canonical acceptance fixture', () => {
  it('contains every release candidate role under stable synthetic aliases', () => {
    expect(acceptanceFixture.users.map(({ role }) => role)).toEqual([
      'SCHOOL_ADMIN',
      'REGISTRAR',
      'TEACHER',
      'STUDENT',
      'GUARDIAN',
      'BUREAU',
      'OPERATIONS',
    ])
    expect(acceptanceFixture.organization.name).toContain('Fictional')
  })
})
