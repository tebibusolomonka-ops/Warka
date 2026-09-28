import type { PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  AssessmentInvigilationError,
  assignAssessmentInvigilator,
} from './assessmentInvigilation.js'

const id = '6f366e77-a14d-469d-9ea5-737091a426cf'
const now = new Date('2026-10-01T08:00:00.000Z')
const session = {
  sessionDate: new Date('2026-10-10T00:00:00.000Z'),
  startTime: '09:00',
  endTime: '10:00',
  schedule: { status: 'scheduled' },
}

function fixture(endsAt: Date | null, collision = false) {
  const client = {
    assessmentSession: { findFirst: async () => session },
    schoolMembership: {
      findUnique: async () => ({
        startsAt: new Date('2026-09-01T00:00:00.000Z'),
        endsAt,
      }),
    },
    user: { findUnique: async () => ({ accountStatus: 'active' }) },
    assessmentInvigilation: {
      findFirst: async () => (collision ? { id } : null),
      create: async (input: { data: unknown }) => input.data,
    },
  }
  return {
    $transaction: async (
      callback: (transaction: typeof client) => Promise<unknown>,
    ) => callback(client),
  } as unknown as PrismaClient
}

describe('assessment invigilation', () => {
  it('rejects access that expires before the session', async () => {
    await expect(
      assignAssessmentInvigilator(
        fixture(new Date('2026-10-05T00:00:00.000Z')),
        id,
        id,
        id,
        id,
        now,
      ),
    ).rejects.toBeInstanceOf(AssessmentInvigilationError)
  })

  it('rejects overlapping invigilation', async () => {
    await expect(
      assignAssessmentInvigilator(fixture(null, true), id, id, id, id, now),
    ).rejects.toBeInstanceOf(AssessmentInvigilationError)
  })

  it('records only invigilation responsibility', async () => {
    expect(
      await assignAssessmentInvigilator(fixture(null), id, id, id, id, now),
    ).toEqual({ schoolId: id, sessionId: id, userId: id, assignedById: id })
  })
})
