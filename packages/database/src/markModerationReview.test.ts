import { Prisma, type PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { MarkModerationStateError } from './markModerationRequests.js'
import { reviewMarkModeration } from './markModerationReview.js'
import { ResultStateError } from './results.js'

const id = '6f366e77-a14d-469d-9ea5-737091a426cf'
const requester = '41e11c90-a746-431c-9aa0-e7f8a7b7987b'

function fixture(
  options: {
    reviewerIsRequester?: boolean
    resultPublished?: boolean
    currentScore?: number
  } = {},
) {
  const written: {
    correction?: Record<string, unknown>
    mark?: Record<string, unknown>
  } = {}
  const assessment = {
    id,
    schoolId: id,
    academicYearId: id,
    gradingPeriodId: id,
    schoolClassId: id,
    subjectId: id,
  }
  const request = {
    id,
    schoolId: id,
    markId: id,
    requestedById: options.reviewerIsRequester ? id : requester,
    originalScore: new Prisma.Decimal(10),
    proposedScore: new Prisma.Decimal(12),
    reason: 'Recheck arithmetic',
    mark: {
      id,
      schoolId: id,
      assessmentId: id,
      score: new Prisma.Decimal(options.currentScore ?? 10),
      assessment,
    },
  }
  const client = {
    markModerationRequest: {
      findFirst: async () => request,
      updateMany: async () => ({ count: 1 }),
      findUniqueOrThrow: async () => ({
        ...request,
        status: 'approved',
        correction: written.correction,
      }),
    },
    school: { findUnique: async () => ({ organizationId: id }) },
    schoolMembership: {
      findUnique: async () => ({
        role: 'approver',
        startsAt: new Date(0),
        endsAt: null,
      }),
    },
    organizationMembership: { findUnique: async () => null },
    resultSet: {
      findFirst: async () => (options.resultPublished ? { id } : null),
    },
    gradebookLock: { findUnique: async () => null },
    markEntryWindow: { findUnique: async () => null },
    mark: {
      updateMany: async (input: { data: Record<string, unknown> }) => {
        written.mark = input.data
        return { count: 1 }
      },
    },
    markCorrection: {
      create: async (input: { data: Record<string, unknown> }) => {
        written.correction = input.data
        return input.data
      },
    },
    auditEvent: { create: async (input: unknown) => input },
  }
  return {
    database: {
      $transaction: async (
        callback: (transaction: typeof client) => Promise<unknown>,
      ) => callback(client),
    } as unknown as PrismaClient,
    written,
  }
}

describe('mark moderation review', () => {
  it('preserves prior value and applies only approved proposed value with reviewer attribution', async () => {
    const { database, written } = fixture()
    await reviewMarkModeration(database, id, id, id, 'approved')
    expect(written.mark?.score).toEqual(new Prisma.Decimal(12))
    expect(written.correction).toMatchObject({
      previousScore: new Prisma.Decimal(10),
      newScore: new Prisma.Decimal(12),
      reviewerId: id,
    })
  })

  it('denies self approval and stale original marks', async () => {
    await expect(
      reviewMarkModeration(
        fixture({ reviewerIsRequester: true }).database,
        id,
        id,
        id,
        'approved',
      ),
    ).rejects.toBeInstanceOf(MarkModerationStateError)
    await expect(
      reviewMarkModeration(
        fixture({ currentScore: 11 }).database,
        id,
        id,
        id,
        'approved',
      ),
    ).rejects.toBeInstanceOf(MarkModerationStateError)
  })

  it('cannot modify a published result through moderation', async () => {
    const { database, written } = fixture({ resultPublished: true })
    await expect(
      reviewMarkModeration(database, id, id, id, 'approved'),
    ).rejects.toBeInstanceOf(ResultStateError)
    expect(written.mark).toBeUndefined()
    expect(written.correction).toBeUndefined()
  })
})
