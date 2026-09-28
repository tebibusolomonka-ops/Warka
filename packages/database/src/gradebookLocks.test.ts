import { Prisma, type Assessment, type PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  assertGradebookUnlocked,
  GradebookLockStateError,
  lockGradebook,
  unlockGradebook,
} from './gradebookLocks.js'

const id = '6f366e77-a14d-469d-9ea5-737091a426cf'
const context = {
  schoolId: id,
  academicYearId: id,
  gradingPeriodId: id,
  schoolClassId: id,
  subjectId: id,
}

function fixture(markExists = true) {
  const events: { action: string; reason?: string }[] = []
  let locked = false
  const client = {
    school: { findUnique: async () => ({ organizationId: id }) },
    organizationMembership: { findUnique: async () => null },
    schoolMembership: {
      findUnique: async () => ({
        role: 'administrator',
        startsAt: new Date(0),
        endsAt: null,
      }),
    },
    assessment: {
      findMany: async () => [{ id }],
      findFirst: async () => ({
        academicYearId: id,
        schoolClassId: id,
        maximumScore: new Prisma.Decimal(20),
      }),
    },
    enrollment: {
      findMany: async () => [
        {
          id,
          studentId: id,
          student: {
            studentReference: 'S1',
            givenName: 'One',
            familyName: null,
          },
        },
      ],
    },
    mark: {
      findMany: async () =>
        markExists
          ? [{ id, enrollmentId: id, score: new Prisma.Decimal(10) }]
          : [],
    },
    assessmentParticipation: { findMany: async () => [] },
    markModerationRequest: { findFirst: async () => null },
    markEntryWindow: { findFirst: async () => null },
    gradebookLock: {
      findUnique: async () => (locked ? { id, locked } : null),
      upsert: async () => {
        locked = true
        return { id, locked }
      },
      updateMany: async () => {
        locked = false
        return { count: 1 }
      },
      findUniqueOrThrow: async () => ({ id, locked }),
    },
    gradebookLockEvent: {
      create: async (input: { data: { action: string; reason?: string } }) => {
        events.push(input.data)
        return input.data
      },
    },
    auditEvent: { create: async (input: unknown) => input },
  }
  return {
    database: {
      ...client,
      $transaction: async (
        callback: (transaction: typeof client) => Promise<unknown>,
      ) => callback(client),
    } as unknown as PrismaClient,
    events,
  }
}

describe('gradebook locking', () => {
  it('blocks lock while a mark is missing', async () => {
    await expect(
      lockGradebook(fixture(false).database, id, context),
    ).rejects.toBeInstanceOf(GradebookLockStateError)
  })

  it('locks complete work and denies ordinary mark entry until authorized unlock', async () => {
    const { database, events } = fixture()
    await lockGradebook(database, id, context)
    await expect(
      assertGradebookUnlocked(database, { ...context } as Assessment),
    ).rejects.toBeInstanceOf(GradebookLockStateError)
    expect(events[0]?.action).toBe('locked')
    await unlockGradebook(database, id, context, 'Review approved reopening')
    expect(events[1]).toMatchObject({
      action: 'unlocked',
      reason: 'Review approved reopening',
    })
    await expect(
      assertGradebookUnlocked(database, { ...context } as Assessment),
    ).resolves.toBeUndefined()
  })

  it('requires an explicit unlock reason', async () => {
    await expect(
      unlockGradebook(fixture().database, id, context, ''),
    ).rejects.toThrow()
  })
})
