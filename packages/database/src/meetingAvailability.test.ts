import type { PrismaClient } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { findSchoolMembership } from './schoolMemberships.js'
import {
  createMeetingAvailability,
  MeetingAvailabilityError,
} from './meetingAvailability.js'

vi.mock('./schoolMemberships.js', () => ({ findSchoolMembership: vi.fn() }))
const schoolId = '11111111-1111-4111-8111-111111111111'
const teacherId = '22222222-2222-4222-8222-222222222222'
const future = new Date(Date.now() + 86400000)
const later = new Date(future.getTime() + 3600000)
const input = {
  schoolId,
  startsAt: future.toISOString(),
  endsAt: later.toISOString(),
  method: 'inPerson' as const,
}

function fixture() {
  const transaction = {
    teacherMeetingAvailability: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'slot', schoolId, teacherId }),
    },
  }
  const database = {
    teachingAssignment: {
      findFirst: vi.fn().mockResolvedValue({ id: 'assignment' }),
    },
    $transaction: vi.fn((callback: (value: typeof transaction) => unknown) =>
      callback(transaction),
    ),
  } as unknown as PrismaClient
  return { database, transaction }
}

describe('teacher meeting availability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(findSchoolMembership).mockResolvedValue({
      role: 'teacher',
    } as never)
  })

  it('creates only nonoverlapping future school windows', async () => {
    const { database, transaction } = fixture()
    await createMeetingAvailability(database, teacherId, input)
    expect(transaction.teacherMeetingAvailability.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId,
        teacherId,
        method: 'inPerson',
      }),
    })
    transaction.teacherMeetingAvailability.findFirst.mockResolvedValue({
      id: 'existing',
    })
    await expect(
      createMeetingAvailability(database, teacherId, input),
    ).rejects.toBeInstanceOf(MeetingAvailabilityError)
    expect(transaction.teacherMeetingAvailability.create).toHaveBeenCalledTimes(
      1,
    )
  })

  it('rejects unrelated staff and invalid times', async () => {
    const { database } = fixture()
    vi.mocked(findSchoolMembership).mockResolvedValue(null)
    await expect(
      createMeetingAvailability(database, teacherId, input),
    ).rejects.toBeInstanceOf(MeetingAvailabilityError)
    await expect(
      createMeetingAvailability(database, teacherId, {
        ...input,
        endsAt: input.startsAt,
      }),
    ).rejects.toThrow()
  })
})
