import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import {
  SearchAccessError,
  searchSchoolScope,
  validatedSearchInput,
} from './schoolSearch.js'

const actorId = '11111111-1111-4111-8111-111111111111'
const schoolId = '22222222-2222-4222-8222-222222222222'
function store(role: string | null, accountStatus = 'active') {
  return {
    school: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          organizationId: '33333333-3333-4333-8333-333333333333',
        }),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ accountStatus }) },
    organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    schoolMembership: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          role ? { role, startsAt: new Date(0), endsAt: null } : null,
        ),
    },
  } as unknown as PrismaClient
}
describe('school search foundation', () => {
  it('denies students, outsiders, and inactive accounts before querying resources', async () => {
    await expect(
      searchSchoolScope(store(null), actorId, schoolId),
    ).rejects.toBeInstanceOf(SearchAccessError)
    await expect(
      searchSchoolScope(store('teacher', 'deactivated'), actorId, schoolId),
    ).rejects.toBeInstanceOf(SearchAccessError)
    expect(
      (await searchSchoolScope(store('teacher'), actorId, schoolId))
        .allowedTypes,
    ).toEqual([])
  })
  it('uses explicit school roles and bounded search input', async () => {
    expect(
      (await searchSchoolScope(store('administrator'), actorId, schoolId))
        .allowedTypes,
    ).toContain('student')
    expect(
      validatedSearchInput({
        actorId,
        schoolId,
        query: '  Ab  ',
        types: ['student', 'student'],
        limit: 10,
        offset: 0,
      }).query,
    ).toBe('Ab')
    expect(() =>
      validatedSearchInput({
        actorId,
        schoolId,
        query: 'x',
        types: ['student'],
        limit: 10,
        offset: 0,
      }),
    ).toThrow()
  })
})
