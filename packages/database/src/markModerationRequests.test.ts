import { Prisma, type PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  MarkModerationRequestSchema,
  MarkModerationStateError,
  requestMarkModeration,
} from './markModerationRequests.js'

const id = '6f366e77-a14d-469d-9ea5-737091a426cf'
const input = {
  schoolId: id,
  markId: id,
  proposedScore: '12',
  reason: 'Recheck arithmetic',
}

describe('mark moderation requests', () => {
  it('requires reason and numeric permitted proposal', () => {
    expect(() =>
      MarkModerationRequestSchema.parse({ ...input, reason: '' }),
    ).toThrow()
    expect(() =>
      MarkModerationRequestSchema.parse({ ...input, proposedScore: 'absent' }),
    ).toThrow()
  })

  it('rejects missing marks before any change', async () => {
    const database = {
      mark: { findFirst: async () => null },
    } as unknown as PrismaClient
    await expect(
      requestMarkModeration(database, id, input),
    ).rejects.toBeInstanceOf(MarkModerationStateError)
  })

  it('preserves the original score and only creates a pending proposal', async () => {
    let data: Record<string, unknown> | undefined
    const assessment = {
      id,
      schoolId: id,
      academicYearId: id,
      schoolClassId: id,
      subjectId: id,
      gradingPeriodId: id,
      maximumScore: new Prisma.Decimal(20),
    }
    const database = {
      mark: {
        findFirst: async () => ({
          id,
          schoolId: id,
          score: new Prisma.Decimal(10),
          assessment,
        }),
      },
      school: { findUnique: async () => ({ organizationId: id }) },
      organizationMembership: { findUnique: async () => null },
      schoolMembership: {
        findUnique: async () => ({
          role: 'administrator',
          startsAt: new Date(0),
          endsAt: null,
        }),
      },
      resultSet: { findFirst: async () => null },
      markModerationRequest: {
        create: async (input: { data: Record<string, unknown> }) => {
          data = input.data
          return input.data
        },
      },
    } as unknown as PrismaClient
    await requestMarkModeration(database, id, input)
    expect(data?.originalScore).toEqual(new Prisma.Decimal(10))
    expect(data?.proposedScore).toEqual(new Prisma.Decimal(12))
    expect(data).not.toHaveProperty('status', 'approved')
  })
})
