import type { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mayViewSchoolEvent } from './eventAudiences.js'
import { hasActiveVerifiedGuardianRelationship } from './guardianRelationships.js'
import { respondToSchoolEvent, EventResponseError } from './eventResponses.js'

vi.mock('./eventAudiences.js', () => ({ mayViewSchoolEvent: vi.fn() }))
vi.mock('./guardianRelationships.js', () => ({
  hasActiveVerifiedGuardianRelationship: vi.fn(),
}))
const schoolId = '11111111-1111-4111-8111-111111111111'
const eventId = '22222222-2222-4222-8222-222222222222'
const userId = '33333333-3333-4333-8333-333333333333'
const studentId = '44444444-4444-4444-8444-444444444444'
function fixture() {
  const transaction = {
    eventResponse: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: eventId, status: 'going' }),
      update: vi.fn().mockResolvedValue({ id: eventId, status: 'notGoing' }),
    },
    eventResponseHistory: { create: vi.fn().mockResolvedValue({}) },
  }
  const database = {
    schoolEvent: { findFirst: vi.fn().mockResolvedValue({ id: eventId }) },
    guardianAccess: {
      findUnique: vi.fn().mockResolvedValue({ guardianId: userId }),
    },
    studentAccess: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn((work: (value: typeof transaction) => unknown) =>
      work(transaction),
    ),
  } as unknown as PrismaClient
  return { database, transaction }
}
beforeEach(() => {
  vi.mocked(mayViewSchoolEvent).mockReset().mockResolvedValue(true)
  vi.mocked(hasActiveVerifiedGuardianRelationship)
    .mockReset()
    .mockResolvedValue(true)
})
describe('school event RSVP', () => {
  it('records a linked child response and preserves changes without duplicate history', async () => {
    const { database, transaction } = fixture()
    await respondToSchoolEvent(
      database,
      userId,
      schoolId,
      eventId,
      'going',
      studentId,
    )
    expect(transaction.eventResponse.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId,
        subjectKey: `child:${studentId}`,
        status: 'going',
      }),
    })
    transaction.eventResponse.findUnique.mockResolvedValue({
      id: eventId,
      status: 'going',
    })
    await respondToSchoolEvent(
      database,
      userId,
      schoolId,
      eventId,
      'going',
      studentId,
    )
    expect(transaction.eventResponseHistory.create).toHaveBeenCalledTimes(1)
    await respondToSchoolEvent(
      database,
      userId,
      schoolId,
      eventId,
      'notGoing',
      studentId,
    )
    expect(transaction.eventResponseHistory.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        previousStatus: 'going',
        newStatus: 'notGoing',
      }),
    })
  })
  it('rejects an unrelated guardian before writing', async () => {
    const { database, transaction } = fixture()
    vi.mocked(hasActiveVerifiedGuardianRelationship).mockResolvedValue(false)
    await expect(
      respondToSchoolEvent(
        database,
        userId,
        schoolId,
        eventId,
        'going',
        studentId,
      ),
    ).rejects.toBeInstanceOf(EventResponseError)
    expect(transaction.eventResponse.create).not.toHaveBeenCalled()
  })
})
