import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import { SearchAccessError, searchStaff } from './schoolSearch.js'

const actorId = '11111111-1111-4111-8111-111111111111'
const schoolId = '22222222-2222-4222-8222-222222222222'
function store(role: string) {
  return {
    school: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          organizationId: '33333333-3333-4333-8333-333333333333',
        }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ accountStatus: 'active' }),
    },
    organizationMembership: { findUnique: vi.fn().mockResolvedValue(null) },
    schoolMembership: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ role, startsAt: new Date(0), endsAt: null }),
      findMany: vi
        .fn()
        .mockResolvedValue([
          {
            role: 'teacher',
            startsAt: new Date(0),
            endsAt: new Date(0),
            user: {
              displayName: 'Ada Staff',
              email: 'ada@example.test',
              accountStatus: 'active',
            },
          },
        ]),
    },
  } as unknown as PrismaClient
}
const input = {
  actorId,
  schoolId,
  query: 'Ada',
  types: ['staff' as const],
  limit: 10,
  offset: 0,
}
describe('staff directory search', () => {
  it('allows a school administrator to inspect safe expired membership status', async () => {
    const database = store('administrator')
    expect(await searchStaff(database, input)).toEqual([
      {
        type: 'staff',
        title: 'Ada Staff',
        subtitle: 'teacher · expired',
        reference: 'ada@example.test',
        schoolId,
      },
    ])
    expect(database.schoolMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId }),
        select: expect.not.objectContaining({
          passwordCredential: true,
          sessions: true,
        }),
      }),
    )
  })
  it('denies teachers before the staff directory query and handles role text', async () => {
    const teacher = store('teacher')
    await expect(searchStaff(teacher, input)).rejects.toBeInstanceOf(
      SearchAccessError,
    )
    expect(teacher.schoolMembership.findMany).not.toHaveBeenCalled()
    const admin = store('administrator')
    await searchStaff(admin, { ...input, query: 'teacher' })
    expect(
      vi.mocked(admin.schoolMembership.findMany).mock.calls[0]?.[0]?.where?.OR,
    ).toEqual(expect.arrayContaining([{ role: 'teacher' }]))
  })
})
