import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import { SearchAccessError, searchStudents } from './schoolSearch.js'

const actorId = '11111111-1111-4111-8111-111111111111'
const schoolId = '22222222-2222-4222-8222-222222222222'
function store(role = 'administrator') {
  return {
    school: {
      findUnique: vi.fn().mockResolvedValue({
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
    },
    student: {
      findMany: vi.fn().mockResolvedValue([
        {
          studentReference: 'WRK-123',
          givenName: 'Ada',
          familyName: 'Learner',
        },
      ]),
    },
  } as unknown as PrismaClient
}
const input = {
  actorId,
  schoolId,
  query: 'WRK-123',
  types: ['student' as const],
  limit: 10,
  offset: 0,
}
describe('student directory search', () => {
  it('finds by reference or name only inside requested school with pagination', async () => {
    const database = store()
    expect(await searchStudents(database, input)).toEqual([
      {
        type: 'student',
        title: 'Ada Learner',
        subtitle: 'WRK-123',
        reference: 'WRK-123',
        schoolId,
      },
    ])
    expect(database.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enrollments: { some: { schoolId } },
          OR: expect.arrayContaining([
            { givenName: { contains: 'WRK-123', mode: 'insensitive' } },
          ]),
        }),
        skip: 0,
        take: 10,
      }),
    )
    await searchStudents(database, { ...input, query: 'Ada', offset: 20 })
    expect(vi.mocked(database.student.findMany).mock.calls[1]?.[0]?.skip).toBe(
      20,
    )
  })
  it('returns empty results and treats wildcard characters literally', async () => {
    const database = store()
    vi.mocked(database.student.findMany).mockResolvedValue([])
    expect(await searchStudents(database, { ...input, query: 'A_%' })).toEqual(
      [],
    )
    expect(
      vi.mocked(database.student.findMany).mock.calls[0]?.[0]?.where?.OR,
    ).toEqual(
      expect.arrayContaining([
        { givenName: { contains: 'A\\_\\%', mode: 'insensitive' } },
      ]),
    )
  })
  it('denies a teacher before accessing the student directory', async () => {
    const database = store('teacher')
    await expect(searchStudents(database, input)).rejects.toBeInstanceOf(
      SearchAccessError,
    )
    expect(database.student.findMany).not.toHaveBeenCalled()
  })
})
