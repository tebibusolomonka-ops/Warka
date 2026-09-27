import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@warka/database'
import { searchSupportAndOperations } from './supportOperationsSearch.js'
import { SearchAccessError } from './schoolSearch.js'

const actorId = '11111111-1111-4111-8111-111111111111'
const schoolId = '22222222-2222-4222-8222-222222222222'
function store(role: string, owner = false) {
  return {
    school: {
      findUnique: vi.fn().mockResolvedValue({
        organizationId: '33333333-3333-4333-8333-333333333333',
      }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ accountStatus: 'active' }),
    },
    organizationMembership: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(owner ? { userId: actorId } : null),
    },
    schoolMembership: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ role, startsAt: new Date(0), endsAt: null }),
    },
    supportRequest: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: 'support-id', title: 'Login issue', status: 'open' },
        ]),
    },
    operationalIncident: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'incident-id',
          title: 'Service outage',
          status: 'investigating',
        },
      ]),
    },
  } as unknown as PrismaClient
}
afterEach(() => vi.unstubAllEnvs())
describe('support and operations search', () => {
  it('returns school-scoped support titles without message bodies', async () => {
    const database = store('administrator')
    const items = await searchSupportAndOperations(database, {
      actorId,
      schoolId,
      query: 'Login',
      types: ['supportRequest'],
      limit: 10,
      offset: 0,
    })
    expect(items).toEqual([
      {
        type: 'supportRequest',
        title: 'Login issue',
        subtitle: 'open',
        reference: 'support-id',
        schoolId,
      },
    ])
    expect(database.supportRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ schoolId }),
        select: { id: true, title: true, status: true },
      }),
    )
  })
  it('denies teachers and restricts incident search to operators', async () => {
    const teacher = store('teacher')
    await expect(
      searchSupportAndOperations(teacher, {
        actorId,
        schoolId,
        query: 'Login',
        types: ['supportRequest'],
        limit: 10,
        offset: 0,
      }),
    ).rejects.toBeInstanceOf(SearchAccessError)
    vi.stubEnv('WARKA_OPERATOR_USER_IDS', actorId)
    const ordinary = store('administrator')
    await expect(
      searchSupportAndOperations(ordinary, {
        actorId,
        schoolId,
        query: 'outage',
        types: ['incident'],
        limit: 10,
        offset: 0,
      }),
    ).rejects.toThrow()
    expect(ordinary.operationalIncident.findMany).not.toHaveBeenCalled()
    const owner = store('administrator', true)
    expect(
      (
        await searchSupportAndOperations(owner, {
          actorId,
          schoolId,
          query: 'outage',
          types: ['incident'],
          limit: 10,
          offset: 0,
        })
      )[0]?.title,
    ).toBe('Service outage')
  })
})
