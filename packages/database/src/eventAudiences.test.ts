import type { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findSchoolMembership } from './schoolMemberships.js'
import { hasActiveVerifiedGuardianRelationship } from './guardianRelationships.js'
import { mayViewSchoolEvent } from './eventAudiences.js'

vi.mock('./schoolMemberships.js', () => ({ findSchoolMembership: vi.fn() }))
vi.mock('./guardianRelationships.js', () => ({
  hasActiveVerifiedGuardianRelationship: vi.fn(),
}))
const schoolId = '11111111-1111-4111-8111-111111111111'
const eventId = '22222222-2222-4222-8222-222222222222'
const actorId = '33333333-3333-4333-8333-333333333333'
const studentId = '44444444-4444-4444-8444-444444444444'

function fixture(
  scope: 'class' | 'staff' | 'wholeSchool',
  status: 'draft' | 'published' = 'published',
) {
  const audience = { scope, schoolClassId: schoolId, gradeLevelId: null }
  const database = {
    schoolEvent: {
      findFirst: vi
        .fn()
        .mockResolvedValue(status === 'published' ? { audience } : null),
    },
    studentAccess: { findUnique: vi.fn().mockResolvedValue({ studentId }) },
    guardianAccess: { findUnique: vi.fn().mockResolvedValue(null) },
    enrollment: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ schoolClassId: schoolId, gradeLevelId: schoolId }),
    },
  } as unknown as PrismaClient
  return database
}
beforeEach(() => {
  vi.mocked(findSchoolMembership).mockReset().mockResolvedValue(null)
  vi.mocked(hasActiveVerifiedGuardianRelationship)
    .mockReset()
    .mockResolvedValue(false)
})
describe('school event audience visibility', () => {
  it('hides draft events and permits only current class audience', async () => {
    expect(
      await mayViewSchoolEvent(
        fixture('class', 'draft'),
        actorId,
        schoolId,
        eventId,
      ),
    ).toBe(false)
    const db = fixture('class')
    expect(await mayViewSchoolEvent(db, actorId, schoolId, eventId)).toBe(true)
    expect(db.schoolEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: eventId,
          schoolId,
          status: { in: ['published', 'completed'] },
        },
      }),
    )
    expect(
      await mayViewSchoolEvent(fixture('staff'), actorId, schoolId, eventId),
    ).toBe(false)
  })
  it('requires a verified linked child for guardian visibility', async () => {
    const db = fixture('wholeSchool')
    vi.mocked(db.studentAccess.findUnique).mockResolvedValue(null)
    vi.mocked(db.guardianAccess.findUnique).mockResolvedValue({
      guardianId: actorId,
    } as never)
    expect(
      await mayViewSchoolEvent(db, actorId, schoolId, eventId, studentId),
    ).toBe(false)
    vi.mocked(hasActiveVerifiedGuardianRelationship).mockResolvedValue(true)
    expect(
      await mayViewSchoolEvent(db, actorId, schoolId, eventId, studentId),
    ).toBe(true)
  })
})
